import { AddToKlarnaError } from "./errors.js";
import { toBase64Url } from "./utils.js";

/**
 * Compose the deep-link *path* that goes inside the outer AppsFlyer OneLink's
 * `deep_link_value` parameter:
 *
 *     <linkPath>/<brandNickname>/<encryptedSegment>
 *
 * `linkPath` is a rooted path like `/loyalty-cards-v2/add-to-klarna` (see
 * {@link resolveConfig}). `encryptedSegment` is the JWE compact serialization
 * wrapped in a single base64url — the wrap is required because the dots in the
 * JWE compact form would otherwise break Klarna's in-app router path matching.
 *
 * Returns a path (not a full URL): the composed value is meant to be passed
 * verbatim to {@link buildOneLinkUrl} as `deepLinkValue`, which handles the
 * outer URL encoding.
 */
export function buildLinkPath(linkPath: string, brandNickname: string, jweCompact: string): string {
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
  return `${linkPath}/${encodeURIComponent(brandNickname)}/${encryptedPayload}`;
}
