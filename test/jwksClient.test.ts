import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { AddToKlarnaError } from "../src/errors.js";
import { fetchJwks, pickEncryptionKey } from "../src/jwksClient.js";

const URL_UNDER_TEST = "https://test.invalid/jwks.json";

const sampleJwks = {
  keys: [
    {
      kid: "kid-eu-1",
      alg: "ECDH-ES+A256KW",
      kty: "EC",
      crv: "P-256",
      use: "enc",
      x: "x",
      y: "y",
    },
  ],
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
          { kid: "kid-eu-sig", alg: "ES256", kty: "EC", crv: "P-256", use: "sig", x: "x", y: "y" },
          {
            kid: "kid-eu-enc",
            alg: "ECDH-ES+A256KW",
            kty: "EC",
            crv: "P-256",
            use: "enc",
            x: "x",
            y: "y",
          },
        ],
      },
      "eu",
    );
    expect(chosen.kid).toBe("kid-eu-enc");
  });

  it("rejects a region match that does not declare use=enc", () => {
    expect(() =>
      pickEncryptionKey(
        {
          keys: [
            {
              kid: "kid-eu-bare",
              alg: "ECDH-ES+A256KW",
              kty: "EC",
              crv: "P-256",
              x: "x",
              y: "y",
            },
          ],
        },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects a region match marked use=sig", () => {
    expect(() =>
      pickEncryptionKey(
        {
          keys: [
            {
              kid: "kid-eu-sig-only",
              alg: "ES256",
              kty: "EC",
              crv: "P-256",
              use: "sig",
              x: "x",
              y: "y",
            },
          ],
        },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });

  it("throws NO_MATCHING_KEY when no key matches the region prefix", () => {
    expect(() =>
      pickEncryptionKey(
        {
          keys: [
            {
              kid: "kid-us-only",
              alg: "ECDH-ES+A256KW",
              kty: "EC",
              crv: "P-256",
              use: "enc",
              x: "x",
              y: "y",
            },
          ],
        },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });

  it("throws NO_MATCHING_KEY when the matching key has no alg", () => {
    expect(() =>
      pickEncryptionKey(
        {
          keys: [{ kid: "kid-eu-bare", kty: "EC", crv: "P-256", use: "enc", x: "x", y: "y" }],
        },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });
});

describe("pickEncryptionKey (key pinning)", () => {
  // Helper that returns a JWK matching the pinned profile. Tests then mutate
  // one field at a time to verify each pin closes the door it's supposed to.
  const valid = (kid: string) => ({
    kid,
    alg: "ECDH-ES+A256KW",
    kty: "EC",
    crv: "P-256",
    use: "enc",
    x: "x",
    y: "y",
  });

  it("accepts the production profile", () => {
    const chosen = pickEncryptionKey({ keys: [valid("kid-eu-prod")] }, "eu");
    expect(chosen.kid).toBe("kid-eu-prod");
  });

  it("rejects a wrong alg (e.g. RSA-OAEP-256)", () => {
    expect(() =>
      pickEncryptionKey({ keys: [{ ...valid("kid-eu-rsa-oaep"), alg: "RSA-OAEP-256" }] }, "eu"),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects a wrong kty (e.g. RSA on the right alg)", () => {
    expect(() =>
      pickEncryptionKey({ keys: [{ ...valid("kid-eu-rsa-kty"), kty: "RSA" }] }, "eu"),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects a wrong crv (e.g. secp256k1)", () => {
    expect(() =>
      pickEncryptionKey({ keys: [{ ...valid("kid-eu-k1"), crv: "secp256k1" }] }, "eu"),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects a symmetric `dir` key even when it claims use=enc", () => {
    expect(() =>
      pickEncryptionKey(
        {
          keys: [
            {
              kid: "kid-eu-dir",
              alg: "dir",
              kty: "oct",
              k: "ZGVhZGJlZWZkZWFkYmVlZmRlYWRiZWVmZGVhZGJlZWY",
              use: "enc",
            },
          ],
        },
        "eu",
      ),
    ).toThrow(AddToKlarnaError);
  });

  it("skips a disallowed key and falls through to a valid one within a region", () => {
    const chosen = pickEncryptionKey(
      {
        keys: [{ ...valid("kid-eu-bad-alg"), alg: "dir", kty: "oct" }, valid("kid-eu-good")],
      },
      "eu",
    );
    expect(chosen.kid).toBe("kid-eu-good");
  });
});
