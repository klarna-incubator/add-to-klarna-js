import { AddToKlarnaError } from "./errors.js";
import type { ClientOptions, ClientTarget, Environment, Region } from "./types.js";

/**
 * Resolved configuration used internally. Everything has been collapsed down
 * to concrete strings by the time we construct one.
 */
export interface ResolvedConfig {
  jwksUrl: string;
  /**
   * The in-app deep-link path prefix. Combined with the brand nickname and
   * encrypted payload by {@link buildLinkPath}, then passed as
   * `deep_link_value` on the outer AppsFlyer OneLink.
   */
  linkPath: string;
  /**
   * AppsFlyer OneLink prefix that wraps the encrypted deep link. See
   * {@link buildOneLinkUrl}.
   */
  oneLinkBaseUrl: string;
  /**
   * Desktop fallback URL (`af_web_dp`). Always the production add-to-klarna
   * page — not selected by `environment` or `clientTarget`.
   */
  desktopFallbackUrl: string;
  /** AppsFlyer media source (`pid`). */
  mediaSource: string;
  /** AppsFlyer campaign name (`c`). */
  campaignName: string;
  region: Region;
}

/**
 * JWKS endpoints per environment. **Independent of region.** Every published
 * JWKS file contains keys for every region, namespaced by a `kid-{region}-`
 * prefix; the picker selects the right one.
 */
const JWKS_URLS: Record<Environment, string> = {
  production: "https://app.klarna.com/.well-known/jwks.json",
  staging:
    "https://eu-non-production-klarna-static-assets.s3.eu-west-1.amazonaws.com/klapp/.well-known/jwks.json",
};

/**
 * In-app deep-link path prefixes. Combined with `<brandNickname>/<encrypted>`
 * to form the value of `deep_link_value` on the outer AppsFlyer OneLink. The
 * Klarna app parses this path and routes to the add-to-klarna screen.
 */
const LINK_PATHS: Record<Environment, string> = {
  production: "/loyalty-cards-v2/add-to-klarna",
  staging: "/loyalty-cards-v2/add-to-klarna",
};

/**
 * AppsFlyer OneLink prefixes. Production uses Klarna's custom `l.klarna.com`
 * short domain; staging uses the standard AppsFlyer `*.onelink.me` host that
 * targets the staging app build.
 */
const ONELINK_BASE_URLS: Record<ClientTarget, string> = {
  pink: "https://l.klarna.com/22XC",
  internalpink: "https://klarnainternalpink.onelink.me/lXgD",
  yellow: "https://klarnayellow.onelink.me/JQ8X",
  staging: "https://klarnastaging.onelink.me/hV1K",
  oneoff: "https://klarnaoneoff.onelink.me/FaEr",
  local: "https://klarnalocal.onelink.me/dxUs",
};

/**
 * Desktop fallback (`af_web_dp`). One production page for every environment
 * and client target — there is no staging-specific fallback.
 */
const DESKTOP_FALLBACK_URL = "https://klarna.com/add-to-klarna";

/**
 * AppsFlyer `pid` (media source).
 */
const MEDIA_SOURCE = "WebApp";

/**
 * AppsFlyer `c` (campaign name).
 */
const CAMPAIGN_NAME = "add-to-klarna";

/**
 * Resolve user-facing client options into a concrete config.
 *
 * Validates inputs up-front so any misconfiguration surfaces as an
 * `INVALID_CONFIG` `AddToKlarnaError` *before* the merchant page issues any
 * network calls.
 */
export function resolveConfig(options: ClientOptions): ResolvedConfig {
  const {
    environment = "production",
    clientTarget = "pink",
    region,
  } = options ?? ({} as ClientOptions);

  if (environment !== "production" && environment !== "staging") {
    throw new AddToKlarnaError(
      "INVALID_CONFIG",
      `Unknown environment: ${String(environment)}. Expected "production" or "staging".`,
    );
  }
  if (region !== "eu" && region !== "us" && region !== "ap") {
    throw new AddToKlarnaError(
      "INVALID_CONFIG",
      `Unknown region: ${String(region)}. Expected "eu", "us" or "ap".`,
    );
  }
  if (
    clientTarget !== "pink" &&
    clientTarget !== "internalpink" &&
    clientTarget !== "yellow" &&
    clientTarget !== "staging" &&
    clientTarget !== "oneoff" &&
    clientTarget !== "local"
  ) {
    throw new AddToKlarnaError(
      "INVALID_CONFIG",
      `Unknown clientTarget: ${String(clientTarget)}. Expected "pink", "internalpink", "yellow", "staging", "oneoff" or "local"`,
    );
  }

  return {
    jwksUrl: JWKS_URLS[environment],
    linkPath: LINK_PATHS[environment],
    oneLinkBaseUrl: ONELINK_BASE_URLS[clientTarget],
    desktopFallbackUrl: DESKTOP_FALLBACK_URL,
    mediaSource: MEDIA_SOURCE,
    campaignName: CAMPAIGN_NAME,
    region,
  };
}
