import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { AddToKlarnaError } from "../src/errors.js";
import { fetchJwks, pickEncryptionKey } from "../src/jwksClient.js";

const URL_UNDER_TEST = "https://test.invalid/jwks.json";

const sampleJwks = {
  keys: [{ kid: "kid-eu-1", alg: "RSA-OAEP-256", kty: "RSA", n: "x", e: "AQAB", use: "enc" }],
};

describe("fetchJwks", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFetchJson(body: unknown, status = 200): jest.Mock {
    const mock = jest.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    );
    (globalThis as { fetch: unknown }).fetch = mock;
    return mock;
  }

  it("fetches and parses the JWKS", async () => {
    const fetchMock = mockFetchJson(sampleJwks);
    const jwks = await fetchJwks(URL_UNDER_TEST);
    expect(jwks.keys[0]!.kid).toBe("kid-eu-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(URL_UNDER_TEST, expect.any(Object));
  });

  it("hits the network on every call (no in-memory cache)", async () => {
    const fetchMock = mockFetchJson(sampleJwks);
    await fetchJwks(URL_UNDER_TEST);
    await fetchJwks(URL_UNDER_TEST);
    await fetchJwks(URL_UNDER_TEST);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("wraps a network failure in JWKS_FETCH_FAILED", async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new TypeError("boom");
    });
    await expect(fetchJwks(URL_UNDER_TEST)).rejects.toMatchObject({ code: "JWKS_FETCH_FAILED" });
  });

  it("wraps an HTTP error in JWKS_FETCH_FAILED", async () => {
    mockFetchJson({}, 503);
    await expect(fetchJwks(URL_UNDER_TEST)).rejects.toMatchObject({ code: "JWKS_FETCH_FAILED" });
  });

  it("wraps an invalid JSON body in JWKS_INVALID", async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn(
      async () =>
        new Response("not json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(fetchJwks(URL_UNDER_TEST)).rejects.toMatchObject({ code: "JWKS_INVALID" });
  });

  it("wraps a JWKS missing `keys` in JWKS_INVALID", async () => {
    mockFetchJson({ foo: "bar" });
    await expect(fetchJwks(URL_UNDER_TEST)).rejects.toMatchObject({ code: "JWKS_INVALID" });
  });

  it("wraps a JWKS where `keys` is not an array in JWKS_INVALID", async () => {
    mockFetchJson({ keys: "not an array" });
    await expect(fetchJwks(URL_UNDER_TEST)).rejects.toMatchObject({ code: "JWKS_INVALID" });
  });
});

describe("pickEncryptionKey (region routing)", () => {
  const mixedJwks = {
    keys: [
      {
        kid: "kid-eu-abc",
        alg: "ECDH-ES+A256KW",
        kty: "EC",
        use: "enc",
        x: "x",
        y: "y",
        crv: "P-256",
      },
      {
        kid: "kid-us-abc",
        alg: "ECDH-ES+A256KW",
        kty: "EC",
        use: "enc",
        x: "x",
        y: "y",
        crv: "P-256",
      },
      {
        kid: "kid-ap-abc",
        alg: "ECDH-ES+A256KW",
        kty: "EC",
        use: "enc",
        x: "x",
        y: "y",
        crv: "P-256",
      },
    ],
  };

  it.each([
    ["eu", "kid-eu-abc"],
    ["us", "kid-us-abc"],
    ["ap", "kid-ap-abc"],
  ] as const)("picks the kid-%s- key for region %s", (region, expectedKid) => {
    const chosen = pickEncryptionKey(mixedJwks, region);
    expect(chosen.kid).toBe(expectedKid);
  });

  it("prefers use=enc within a region", () => {
    const chosen = pickEncryptionKey(
      {
        keys: [
          { kid: "kid-eu-sig", alg: "RS256", kty: "RSA", use: "sig", n: "x", e: "AQAB" },
          { kid: "kid-eu-enc", alg: "RSA-OAEP-256", kty: "RSA", use: "enc", n: "x", e: "AQAB" },
        ],
      },
      "eu",
    );
    expect(chosen.kid).toBe("kid-eu-enc");
  });

  it("rejects a region match that does not declare use=enc", () => {
    expect(() =>
      pickEncryptionKey(
        { keys: [{ kid: "kid-eu-bare", alg: "RSA-OAEP-256", kty: "RSA", n: "x", e: "AQAB" }] },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects a region match marked use=sig", () => {
    expect(() =>
      pickEncryptionKey(
        {
          keys: [
            { kid: "kid-eu-sig-only", alg: "RS256", kty: "RSA", use: "sig", n: "x", e: "AQAB" },
          ],
        },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });

  it("throws NO_MATCHING_KEY when no key matches the region prefix", () => {
    expect(() =>
      pickEncryptionKey(
        { keys: [{ kid: "kid-us-only", alg: "RSA-OAEP-256", kty: "RSA", n: "x", e: "AQAB" }] },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });

  it("throws NO_MATCHING_KEY when the matching key has no alg", () => {
    expect(() =>
      pickEncryptionKey(
        { keys: [{ kid: "kid-eu-bare", kty: "RSA", use: "enc", n: "x", e: "AQAB" }] },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });
});
