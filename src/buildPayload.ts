import { AddToKlarnaError } from "./errors.js";
import type { DecryptedPayload } from "./types.js";

/**
 * Build the plaintext payload that goes inside the JWE.
 *
 * The schema is `{ inputId, linkId, iat }`. Klarna's backend validates this
 * shape on decryption, so the field names and types must remain stable.
 */
export function buildPayload(inputId: string): DecryptedPayload {
  if (typeof inputId !== "string" || inputId.length === 0) {
    throw new AddToKlarnaError("INVALID_INPUT", "`inputId` must be a non-empty string.");
  }
  return {
    inputId,
    linkId: globalThis.crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
  };
}
