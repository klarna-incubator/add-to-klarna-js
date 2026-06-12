import { buildLinkUrl } from "./buildLinkUrl.js";
import { buildPayload } from "./buildPayload.js";
import { resolveConfig } from "./config.js";
import { encryptJwe } from "./encryptJwe.js";
import { AddToKlarnaError } from "./errors.js";
import { fetchJwks, pickEncryptionKey } from "./jwksClient.js";
import type { AddToKlarnaClient, BuildLinkInput, ClientOptions } from "./types.js";

/**
 * Create an Add-to-Klarna client.
 *
 * Construction is cheap and synchronous: it validates options and wires up
 * the pipeline. The first network call happens on the first
 * {@link AddToKlarnaClient.buildLink} / {@link AddToKlarnaClient.redirect}.
 * Every `buildLink` re-fetches the JWKS — caching is handled by the HTTP
 * layer and Klarna's CDN, not in memory.
 */
export function createAddToKlarnaClient(options: ClientOptions): AddToKlarnaClient {
  const config = resolveConfig(options);

  async function buildLink(input: BuildLinkInput): Promise<string> {
    if (!input || typeof input !== "object") {
      throw new AddToKlarnaError(
        "INVALID_INPUT",
        "buildLink() requires an object with `brandNickname` and `inputId`.",
      );
    }
    const payload = buildPayload(input.inputId);
    const jwks = await fetchJwks(config.jwksUrl);
    const key = pickEncryptionKey(jwks, config.region);
    const jwe = await encryptJwe(payload, key);
    return buildLinkUrl(config.linkBaseUrl, input.brandNickname, jwe);
  }

  async function redirect(input: BuildLinkInput): Promise<void> {
    const url = await buildLink(input);
    const w = (globalThis as { window?: { location?: { assign?: (u: string) => void } } }).window;
    const assign = w?.location?.assign;
    if (typeof assign !== "function") {
      throw new AddToKlarnaError(
        "NAVIGATION_UNAVAILABLE",
        "redirect() requires a browser context with `window.location.assign`. Use buildLink() and navigate yourself in non-browser environments.",
      );
    }
    assign.call(w!.location, url);
  }

  return { buildLink, redirect };
}
