import { AddToKlarnaError } from "./errors.js";
import type { ClientOptions, Environment, Region } from "./types.js";

/**
 * Resolved configuration used internally. Everything has been collapsed down
 * to concrete strings by the time we construct one.
 */
export interface ResolvedConfig {
  jwksUrl: string;
  linkBaseUrl: string;
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
 * Base URLs for the universal link. The final URL appended is:
 *
 *     <base>/<brandNickname>/<encryptedPayload>
 *
 * Production uses an HTTPS Universal Link. Staging uses the dev custom scheme
 * so taps open the staging app build directly.
 */
const LINK_BASE_URLS: Record<Environment, string> = {
  production: "https://app.klarna.com/loyalty-cards-v2/add-to-klarna",
  staging: "klarnadev://loyalty-cards-v2/add-to-klarna",
};

/**
 * Resolve user-facing client options into a concrete config.
 *
 * Validates inputs up-front so any misconfiguration surfaces as an
 * `INVALID_CONFIG` `AddToKlarnaError` *before* the merchant page issues any
 * network calls.
 */
export function resolveConfig(options: ClientOptions): ResolvedConfig {
  const { environment = "production", region } = options ?? ({} as ClientOptions);

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

  return {
    jwksUrl: JWKS_URLS[environment],
    linkBaseUrl: LINK_BASE_URLS[environment],
    region,
  };
}
