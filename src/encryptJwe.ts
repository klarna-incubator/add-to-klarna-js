import { EncryptJWT, importJWK, type JWK } from "jose";

import { AddToKlarnaError } from "./errors.js";
import type { DecryptedPayload } from "./types.js";

/**
 * The JWE profile this library produces. Pinned end-to-end:
 *
 * - `ALG` (key-encryption algorithm)
 * - `ENC` (content-encryption algorithm)
 *
 * `pickEncryptionKey` enforces the matching `kty`/`crv` on the JWKS side,
 * so a JWKS that drifts off this profile fails closed with `NO_MATCHING_KEY`
 * instead of silently producing a non-decryptable link. Changing either
 * constant is an SDK-coordinated event with Klarna's backend.
 */
export const ALG = "ECDH-ES+A256KW";
export const ENC = "A256GCM";

/**
 * Encrypt the plaintext payload as a JWE using the given JWK. Produces the
 * compact serialization (five dot-separated base64url segments).
 */
export async function encryptJwe(
  payload: DecryptedPayload,
  key: JWK & { kid: string },
): Promise<string> {
  let imported: Awaited<ReturnType<typeof importJWK>>;
  try {
    imported = await importJWK(key, ALG);
  } catch (cause) {
    throw new AddToKlarnaError(
      "ENCRYPTION_FAILED",
      `Could not import JWK with kid="${key.kid}" for alg="${ALG}".`,
      { cause },
    );
  }

  try {
    return await new EncryptJWT({
      inputId: payload.inputId,
      linkId: payload.linkId,
    })
      .setProtectedHeader({
        alg: ALG,
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
