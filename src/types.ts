/**
 * The Klarna deployment region the link should target. Selects which key the
 * library picks out of the JWKS (keys are namespaced via a `kid-{region}-`
 * prefix). Does *not* change the JWKS URL or the universal-link host — both
 * are determined solely by {@link Environment}.
 */
export type Region = "eu" | "us" | "ap";

/**
 * The Klarna environment to target.
 *
 * - `production` — the production JWKS and universal-link host.
 * - `staging` — the non-production JWKS and a custom URL scheme that opens
 *   Klarna's staging app build. Use this for development and testing only.
 */
export type Environment = "production" | "staging";

/**
 * Options accepted by {@link createAddToKlarnaClient}.
 *
 * Deliberately tiny: just where you are (environment) and which region's key
 * to use. The JWKS endpoint and universal-link host are derived from
 * `environment` alone — they are not configurable.
 */
export interface ClientOptions {
  environment?: Environment;
  region: Region;
}

/**
 * Inputs the merchant provides on every call.
 */
export interface BuildLinkInput {
  /**
   * Klarna's canonical short identifier for the loyalty program. Case-sensitive.
   * Must be non-empty and contain no whitespace, `/`, `?` or `#`.
   */
  brandNickname: string;

  /**
   * The merchant's identifier for this loyalty card holder — typically the
   * loyalty card number. The value is encrypted before it leaves the merchant's
   * browser; Klarna only decrypts it server-side.
   */
  inputId: string;
}

/**
 * The public client surface.
 */
export interface AddToKlarnaClient {
  /**
   * Build a universal link URL without navigating to it.
   *
   * Each call mints a fresh `linkId` and re-fetches the JWKS — no in-memory
   * cache. Caching is delegated to the HTTP layer + Klarna's CDN.
   */
  buildLink(input: BuildLinkInput): Promise<string>;

  /**
   * Build a link and immediately navigate the current browser tab to it.
   * Throws (without navigating) if any step fails. Only valid in a browser
   * context where `window.location.assign` is available.
   */
  redirect(input: BuildLinkInput): Promise<void>;
}

/**
 * The plaintext payload Klarna's backend decrypts and validates. Exported
 * mostly for test fixtures; merchants do not need to construct this directly.
 */
export interface DecryptedPayload {
  inputId: string;
  linkId: string;
  iat: number;
}
