import { AddToKlarnaError } from "./errors.js";
import { toBase64Url } from "./utils.js";

/**
 * Compose the final universal-link URL:
 *
 *     <baseUrl>/<brandNickname>/<encryptedSegment>
 *
 * `baseUrl` already includes the `/add-to-klarna` route segment (resolved in
 * {@link resolveConfig}). `encryptedSegment` is the JWE compact serialization
 * wrapped in a single base64url — the wrap is required by the Klarna web
 * router because the dots in the JWE compact form would otherwise break
 * path matching.
 */
export function buildLinkUrl(baseUrl: string, brandNickname: string, jweCompact: string): string {
  if (typeof brandNickname !== "string" || brandNickname.length === 0) {
    throw new AddToKlarnaError("INVALID_INPUT", "`brandNickname` must be a non-empty string.");
  }
  if (/[\s/?#]/.test(brandNickname)) {
    throw new AddToKlarnaError(
      "INVALID_INPUT",
      `\`brandNickname\` contains invalid characters (whitespace, "/", "?" or "#"): ${brandNickname}`,
    );
  }
  if (typeof jweCompact !== "string" || jweCompact.length === 0) {
    throw new AddToKlarnaError("ENCRYPTION_FAILED", "Empty JWE returned from encryptor.");
  }
  const encryptedPayload = toBase64Url(jweCompact);
  return `${baseUrl}/${encodeURIComponent(brandNickname)}/${encryptedPayload}`;
}
