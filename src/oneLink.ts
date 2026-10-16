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
   * The in-app deep link path. Sent as `deep_link_value`. AppsFlyer hands
   * this string to the app for in-app routing once the app is open, and
   * replays it after install when the app was not installed (deferred deep
   * linking). It does not launch the app.
   */
  deepLinkValue: string;

  /**
   * Custom URI scheme for the targeted Klarna build, including `://`
   * (for example `klarna://` or `klarnaoneoff://`). Combined with
   * `deepLinkValue` and sent as `af_dp`, so the address that launches the
   * app is also the screen.
   */
  appUriScheme: string;

  /** Desktop fallback URL. Sent as `af_web_dp`. */
  webFallbackUrl: string;
}

/**
 * Compose an AppsFlyer OneLink URL that:
 *
 *  - launches the installed Klarna app directly to `deepLinkValue` via `af_dp`,
 *  - falls back to the App Store / Play Store (configured on the OneLink
 *    template, not on this URL) when the app is not installed on mobile,
 *  - falls back to `webFallbackUrl` on desktop.
 *
 * The returned URL has the shape:
 *
 *     <oneLinkBaseUrl>?pid=<pid>&c=<c>&af_param_forwarding=false
 *       &af_dp=<url-encoded scheme + deepLinkValue>
 *       &deep_link_value=<url-encoded deepLinkValue>
 *       &af_web_dp=<url-encoded webFallbackUrl>
 *
 * `af_param_forwarding=false` keeps AppsFlyer from copying the other query
 * parameters onto `af_web_dp`. The OneLink template forwards them otherwise,
 * and the desktop page then redirects to a localized URL that repeats the
 * payload in `grs`. With both `af_dp` and `deep_link_value` that URL passes
 * CloudFront's length limit and the fallback returns 403. The app still
 * receives `af_dp` and `deep_link_value` from the OneLink itself.
 *
 * `af_dp` uses two slashes (`klarnaoneoff://loyalty-cards-v2/...`). The Klarna
 * app inserts the third slash before matching the path. A bare scheme opens
 * the app and leaves it on the home screen, because that launch address has
 * no route.
 *
 * Throws `AddToKlarnaError` with `INVALID_CONFIG` if any URL or the app URI
 * scheme is missing or malformed, or `INVALID_INPUT` if `deepLinkValue` is
 * empty.
 */
export function buildOneLinkUrl(input: BuildOneLinkInput): string {
  requireNonEmptyString("oneLinkBaseUrl", input.oneLinkBaseUrl, "INVALID_CONFIG");
  requireNonEmptyString("pid", input.pid, "INVALID_CONFIG");
  requireNonEmptyString("c", input.c, "INVALID_CONFIG");
  requireNonEmptyString("appUriScheme", input.appUriScheme, "INVALID_CONFIG");
  requireNonEmptyString("deepLinkValue", input.deepLinkValue, "INVALID_INPUT");
  requireHttpUrl("webFallbackUrl", input.webFallbackUrl);

  // Insertion order is preserved by URLSearchParams / Object.entries, and it
  // matters here only for output stability (easier to snapshot in tests).
  const params: Array<[string, string]> = [
    ["pid", input.pid],
    ["c", input.c],
    ["af_param_forwarding", "false"],
    ["af_dp", buildAppDeepLink(input.appUriScheme, input.deepLinkValue)],
    ["deep_link_value", input.deepLinkValue],
    ["af_web_dp", input.webFallbackUrl],
  ];

  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");

  return `${input.oneLinkBaseUrl}?${query}`;
}

/**
 * `scheme://` + path, without a leading slash on the path, so the result is
 * `klarnaoneoff://loyalty-cards-v2/add-to-klarna/...` rather than three slashes.
 */
function buildAppDeepLink(appUriScheme: string, deepLinkValue: string): string {
  const path = deepLinkValue.startsWith("/") ? deepLinkValue.slice(1) : deepLinkValue;
  return `${appUriScheme}${path}`;
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
