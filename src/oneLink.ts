import { AddToKlarnaError } from "./errors.js";

/**
 * Inputs for {@link buildOneLinkUrl}.
 *
 * All fields are required — this function is deliberately dumb: it takes
 * concrete URLs and composes them into an AppsFlyer OneLink. Environment
 * defaults live in {@link resolveConfig}.
 */
export interface BuildOneLinkInput {
  /** The AppsFlyer OneLink prefix (e.g. `https://l.klarna.com/22XC`). */
  oneLinkBaseUrl: string;

  /** AppsFlyer media source. Sent as `pid`. */
  pid: string;

  /** AppsFlyer campaign name. Sent as `c`. */
  c: string;

  /**
   * The in-app deep link path. Sent as `deep_link_value`. When the Klarna app
   * is installed on the device, AppsFlyer hands this string to the app for
   * in-app routing; when the app is not installed, AppsFlyer stores it and
   * replays it after install (deferred deep linking).
   */
  deepLinkValue: string;

  /** Desktop fallback URL. Sent as `af_web_dp`. */
  webFallbackUrl: string;
}

/**
 * Compose an AppsFlyer OneLink URL that:
 *
 *  - opens the Klarna app to the given `deepLinkValue` when the app is
 *    installed on iOS or Android,
 *  - falls back to the App Store / Play Store (configured on the OneLink
 *    template, not on this URL) when the app is not installed on mobile,
 *  - falls back to `webFallbackUrl` on desktop.
 *
 * The returned URL has the shape:
 *
 *     <oneLinkBaseUrl>?pid=<pid>&c=<c>&deep_link_value=<url-encoded deepLinkValue>
 *       &af_web_dp=<url-encoded webFallbackUrl>
 *
 * Throws `AddToKlarnaError` with `INVALID_CONFIG` if any URL is missing or
 * malformed, or `INVALID_INPUT` if `deepLinkValue` is empty.
 */
export function buildOneLinkUrl(input: BuildOneLinkInput): string {
  requireNonEmptyString("oneLinkBaseUrl", input.oneLinkBaseUrl, "INVALID_CONFIG");
  requireNonEmptyString("pid", input.pid, "INVALID_CONFIG");
  requireNonEmptyString("c", input.c, "INVALID_CONFIG");
  requireNonEmptyString("deepLinkValue", input.deepLinkValue, "INVALID_INPUT");
  requireHttpUrl("webFallbackUrl", input.webFallbackUrl);

  // Insertion order is preserved by URLSearchParams / Object.entries, and it
  // matters here only for output stability (easier to snapshot in tests).
  const params: Array<[string, string]> = [
    ["pid", input.pid],
    ["c", input.c],
    ["deep_link_value", input.deepLinkValue],
    ["af_web_dp", input.webFallbackUrl],
  ];

  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");

  return `${input.oneLinkBaseUrl}?${query}`;
}

function requireNonEmptyString(
  name: string,
  value: unknown,
  code: "INVALID_CONFIG" | "INVALID_INPUT",
): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new AddToKlarnaError(code, `\`${name}\` must be a non-empty string.`);
  }
}

function requireHttpUrl(name: string, value: unknown): void {
  requireNonEmptyString(name, value, "INVALID_CONFIG");
  let url: URL;
  try {
    url = new URL(value as string);
  } catch {
    throw new AddToKlarnaError("INVALID_CONFIG", `\`${name}\` is not a valid URL: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AddToKlarnaError(
      "INVALID_CONFIG",
      `\`${name}\` must use http or https. Got: ${value}`,
    );
  }
}
