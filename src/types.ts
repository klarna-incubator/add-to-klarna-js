/**
 * The Klarna deployment region the link should target. Selects which key the
 * library picks out of the JWKS (keys are namespaced via a `kid-{region}-`
 * prefix). Does *not* change the JWKS URL ({@link Environment}) or the
 * AppsFlyer OneLink host ({@link ClientTarget}).
 */
export type Region = "eu" | "us" | "ap";

/**
 * The Klarna backend environment to target.
 *
 * - `production` — the production JWKS.
 * - `staging` — the non-production JWKS. Use this for development and
 *   testing only.
 *
 * Does *not* select the AppsFlyer OneLink host — that is {@link ClientTarget}.
 * Desktop fallback (`af_web_dp`) is a single production page for every
 * environment.
 */
export type Environment = "production" | "staging";

/**
 * The Klarna client application we are targeting.
 *
 * - `pink` — the production application that is available to all of our users
 * - `internalpink` — the pre-release production application, Klarna internal
 * - `yellow` — internal build targeting the production backend
 * - `staging` — internal build targeting the staging backend
 * - `oneoff` — internal build created from a specific commit, targeting either environment
 * - `local` — targets the local simulator
 */
export type ClientTarget = "pink" | "internalpink" | "yellow" | "staging" | "oneoff" | "local";

/**
 * Options accepted by {@link createAddToKlarnaClient}.
 *
 * Deliberately tiny: just which backend (`environment`), which app
 * (`clientTarget`), and which region's key to use. The JWKS endpoint is
 * derived from `environment`; the AppsFlyer OneLink host is derived from
 * `clientTarget`. Desktop fallback is a single production page for every
 * combination. None of these are otherwise configurable.
 */
export interface ClientOptions {
  environment?: Environment;
  clientTarget?: ClientTarget;
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
   * Build an AppsFlyer OneLink URL without navigating to it.
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
