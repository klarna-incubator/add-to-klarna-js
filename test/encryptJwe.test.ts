import { describe, expect, it } from "@jest/globals";
import { jwtDecrypt } from "jose";

import { AddToKlarnaError } from "../src/errors.js";
import { ENC, encryptJwe } from "../src/encryptJwe.js";
import { generateTestKeypair } from "./fixtures.js";

describe("encryptJwe", () => {
  it("produces a JWE whose plaintext decrypts back to the input payload", async () => {
    const { publicJwk, privateKey, kid, alg } = await generateTestKeypair();

    const payload = { inputId: "merchant-1", linkId: "link-uuid", iat: 1_700_000_000 };
    const jwe = await encryptJwe(payload, publicJwk);

    const { payload: decoded, protectedHeader } = await jwtDecrypt(jwe, privateKey);
    expect(decoded.inputId).toBe(payload.inputId);
    expect(decoded.linkId).toBe(payload.linkId);
    expect(decoded.iat).toBe(payload.iat);
    expect(protectedHeader.kid).toBe(kid);
    expect(protectedHeader.alg).toBe(alg);
    expect(protectedHeader.enc).toBe(ENC);
    expect(protectedHeader.typ).toBe("JWT");
    expect(protectedHeader.cty).toBe("application/json");
  });

  it("wraps a JWK import failure in ENCRYPTION_FAILED", async () => {
    const brokenJwk = { kid: "k", alg: "RSA-OAEP-256", kty: "RSA", n: "!!!", e: "AQAB" };
    await expect(
      encryptJwe({ inputId: "x", linkId: "y", iat: 0 }, brokenJwk),
    ).rejects.toBeInstanceOf(AddToKlarnaError);
  });

  it("wraps an encryption failure in ENCRYPTION_FAILED", async () => {
    const { publicJwk } = await generateTestKeypair("kid-x", "RSA-OAEP-256");
    await expect(
      encryptJwe(
        { inputId: "x", linkId: "y", iat: 0 },
        { ...publicJwk, alg: "totally-bogus" as string },
      ),
    ).rejects.toBeInstanceOf(AddToKlarnaError);
  });
});
