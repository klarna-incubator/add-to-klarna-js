import { EncryptJWT, importJWK, type JWK } from "jose";

import { AddToKlarnaError } from "./errors.js";
import type { DecryptedPayload } from "./types.js";

/**
 * The content-encryption algorithm. Pinned to the JWE profile that Klarna's
 * backend accepts.
 *
 * The key-encryption algorithm (`alg`) is read from the JWK rather than
 * hardcoded, so a server-side rotation that swaps `alg` works without a
 * client release as long as `jose` still supports it.
 */
export const ENC = "A256GCM";

/**
 * Encrypt the plaintext payload as a JWE using the given JWK. Produces the
 * compact serialization (five dot-separated base64url segments).
 */
export async function encryptJwe(
  payload: DecryptedPayload,
  key: JWK & { kid: string; alg: string },
): Promise<string> {
  let imported: Awaited<ReturnType<typeof importJWK>>;
  try {
    imported = await importJWK(key, key.alg);
  } catch (cause) {
    throw new AddToKlarnaError(
      "ENCRYPTION_FAILED",
      `Could not import JWK with kid="${key.kid}" and alg="${key.alg}".`,
      { cause },
    );
  }

  try {
    return await new EncryptJWT({
      inputId: payload.inputId,
      linkId: payload.linkId,
    })
      .setProtectedHeader({
        alg: key.alg,
        enc: ENC,
        kid: key.kid,
        typ: "JWT",
        cty: "application/json",
      })
      .setIssuedAt(payload.iat)
      .encrypt(imported);
  } catch (cause) {
    throw new AddToKlarnaError("ENCRYPTION_FAILED", `JWE encryption failed for kid="${key.kid}".`, {
      cause,
    });
  }
}
