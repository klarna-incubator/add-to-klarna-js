import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { jwtDecrypt } from "jose";

import { createAddToKlarnaClient } from "../src/client.js";
import { AddToKlarnaError } from "../src/errors.js";
import { ENC } from "../src/encryptJwe.js";
import { fromBase64Url } from "../src/utils.js";
import { extractEncryptedPayload, generateTestKeypair, mockFetchReturning } from "./fixtures.js";

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  jest.restoreAllMocks();
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  (globalThis as { window?: unknown }).window = originalWindow;
});

describe("createAddToKlarnaClient.buildLink (round-trip)", () => {
  it("produces a URL whose payload decrypts back to {inputId, linkId, iat}", async () => {
    const { jwks, privateKey, kid, alg } = await generateTestKeypair("kid-eu-golden");
    mockFetchReturning(jwks);
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    jest
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("11111111-1111-4111-8111-111111111111");

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    const url = await client.buildLink({
      brandNickname: "someBrandNickname",
      inputId: "merchant-123",
    });

    expect(url).toMatch(
      /^klarnadev:\/\/loyalty-cards-v2\/add-to-klarna\/someBrandNickname\/[A-Za-z0-9_-]+$/,
    );

    const compact = fromBase64Url(extractEncryptedPayload(url));
    const { payload, protectedHeader } = await jwtDecrypt(compact, privateKey);
    expect(payload.inputId).toBe("merchant-123");
    expect(payload.linkId).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.iat).toBe(1_700_000_000);
    expect(protectedHeader.kid).toBe(kid);
    expect(protectedHeader.alg).toBe(alg);
    expect(protectedHeader.enc).toBe(ENC);
    expect(protectedHeader.typ).toBe("JWT");
    expect(protectedHeader.cty).toBe("application/json");
  });

  it("fetches the JWKS on every call (no in-memory cache)", async () => {
    const { jwks } = await generateTestKeypair("kid-eu-test");
    const fetchMock = mockFetchReturning(jwks);

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    await client.buildLink({ brandNickname: "a", inputId: "1" });
    await client.buildLink({ brandNickname: "a", inputId: "2" });
    await client.buildLink({ brandNickname: "a", inputId: "3" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("mints a fresh linkId per call (different URLs)", async () => {
    const { jwks } = await generateTestKeypair("kid-eu-test");
    mockFetchReturning(jwks);

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    const a = await client.buildLink({ brandNickname: "a", inputId: "1" });
    const b = await client.buildLink({ brandNickname: "a", inputId: "1" });
    expect(a).not.toBe(b);
  });

  it("rejects a null input object", async () => {
    const { jwks } = await generateTestKeypair("kid-eu-test");
    mockFetchReturning(jwks);

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    await expect(
      client.buildLink(null as unknown as { brandNickname: string; inputId: string }),
    ).rejects.toBeInstanceOf(AddToKlarnaError);
  });

  it("rejects an invalid brandNickname", async () => {
    const { jwks } = await generateTestKeypair("kid-eu-test");
    mockFetchReturning(jwks);

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    await expect(
      client.buildLink({ brandNickname: "has space", inputId: "x" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("surfaces network failures from JWKS fetching", async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new TypeError("offline");
    });

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    await expect(
      client.buildLink({ brandNickname: "someBrandNickname", inputId: "x" }),
    ).rejects.toMatchObject({ code: "JWKS_FETCH_FAILED" });
  });

  it("picks the key matching the configured region", async () => {
    const eu = await generateTestKeypair("kid-eu-r1");
    const us = await generateTestKeypair("kid-us-r1");
    const ap = await generateTestKeypair("kid-ap-r1");
    mockFetchReturning({ keys: [...eu.jwks.keys, ...us.jwks.keys, ...ap.jwks.keys] });

    const apClient = createAddToKlarnaClient({ environment: "staging", region: "ap" });
    const url = await apClient.buildLink({ brandNickname: "x", inputId: "y" });
    const compact = fromBase64Url(extractEncryptedPayload(url));
    const { protectedHeader } = await jwtDecrypt(compact, ap.privateKey);
    expect(protectedHeader.kid).toBe(ap.kid);
  });

  it("throws NO_MATCHING_KEY when the JWKS has no keys for the requested region", async () => {
    const { jwks } = await generateTestKeypair("kid-eu-only");
    mockFetchReturning(jwks);

    const client = createAddToKlarnaClient({ environment: "staging", region: "us" });
    await expect(client.buildLink({ brandNickname: "x", inputId: "y" })).rejects.toMatchObject({
      code: "NO_MATCHING_KEY",
    });
  });

  it("targets production app.klarna.com for environment=production", async () => {
    const fetchMock = jest.fn(
      async () => new Response(JSON.stringify({ keys: [] }), { status: 200 }),
    );
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    const client = createAddToKlarnaClient({ environment: "production", region: "eu" });
    await expect(client.buildLink({ brandNickname: "x", inputId: "y" })).rejects.toBeInstanceOf(
      AddToKlarnaError,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.klarna.com/.well-known/jwks.json",
      expect.any(Object),
    );
  });

  it("defaults to production when environment is omitted", async () => {
    const fetchMock = jest.fn(
      async () => new Response(JSON.stringify({ keys: [] }), { status: 200 }),
    );
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    const client = createAddToKlarnaClient({ region: "eu" });
    await expect(client.buildLink({ brandNickname: "x", inputId: "y" })).rejects.toBeInstanceOf(
      AddToKlarnaError,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.klarna.com/.well-known/jwks.json",
      expect.any(Object),
    );
  });
});

describe("createAddToKlarnaClient.redirect", () => {
  it("delegates to window.location.assign with the built URL", async () => {
    const { jwks } = await generateTestKeypair("kid-eu-test");
    mockFetchReturning(jwks);
    const assign = jest.fn();
    (globalThis as { window?: unknown }).window = { location: { assign } };

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    await client.redirect({ brandNickname: "someBrandNickname", inputId: "x" });

    expect(assign).toHaveBeenCalledTimes(1);
    const calledUrl = assign.mock.calls[0]![0] as string;
    expect(
      calledUrl.startsWith("klarnadev://loyalty-cards-v2/add-to-klarna/someBrandNickname/"),
    ).toBe(true);
  });

  it("throws NAVIGATION_UNAVAILABLE when window is not present", async () => {
    const { jwks } = await generateTestKeypair("kid-eu-test");
    mockFetchReturning(jwks);
    delete (globalThis as { window?: unknown }).window;

    const client = createAddToKlarnaClient({ environment: "staging", region: "eu" });
    await expect(
      client.redirect({ brandNickname: "someBrandNickname", inputId: "x" }),
    ).rejects.toMatchObject({ code: "NAVIGATION_UNAVAILABLE" });
  });
});

describe("createAddToKlarnaClient validation at construction time", () => {
  it("rejects an invalid environment", () => {
    expect(() =>
      createAddToKlarnaClient({
        environment: "qa" as unknown as "staging",
        region: "eu",
      }),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects an invalid region", () => {
    expect(() =>
      createAddToKlarnaClient({
        environment: "production",
        region: "asia" as unknown as "eu",
      }),
    ).toThrow(AddToKlarnaError);
  });
});
