import type { JWK } from "jose";

import { AddToKlarnaError } from "./errors.js";
import type { Region } from "./types.js";

/**
 * The minimal JWKS shape we depend on. The actual file may contain extra
 * fields per RFC 7517; we ignore everything we do not need.
 */
export interface Jwks {
  keys: Array<JWK & { kid?: string; alg?: string; use?: string }>;
}

/**
 * Fetch and parse the JWKS at `url`. There is no in-memory cache — caching is
 * delegated to the HTTP layer and Klarna's CDN. Wraps every failure mode in
 * a typed `AddToKlarnaError`.
 */
export async function fetchJwks(url: string): Promise<Jwks> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    throw new AddToKlarnaError("JWKS_FETCH_FAILED", `Failed to fetch JWKS from ${url}`, { cause });
  }

  if (!response.ok) {
    throw new AddToKlarnaError(
      "JWKS_FETCH_FAILED",
      `JWKS fetch returned HTTP ${response.status} ${response.statusText} for ${url}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new AddToKlarnaError("JWKS_INVALID", "JWKS response body was not valid JSON.", { cause });
  }

  return assertJwks(body);
}

/**
 * Pick the encryption key for `region` from a JWKS document.
 *
 * Selection rules, in order:
 *
 * 1. Keys must declare `use === "enc"` (RFC 7517). Signing keys and keys that
 *    don't set `use` explicitly are rejected.
 * 2. Keys must have a `kid` starting with `kid-{region}-`. The published JWKS
 *    files mix keys for every region; the prefix is how we route.
 * 3. If multiple keys match, the first one in document order wins. The JWKS
 *    is published with the most recent key first.
 *
 * Throws `NO_MATCHING_KEY` when nothing matches.
 */
export function pickEncryptionKey(jwks: Jwks, region: Region): JWK & { kid: string; alg: string } {
  const prefix = `kid-${region}-`;
  const chosen = jwks.keys.find(
    (k) => k.use === "enc" && typeof k.kid === "string" && k.kid.startsWith(prefix),
  );

  if (!chosen || typeof chosen.kid !== "string") {
    throw new AddToKlarnaError(
      "NO_MATCHING_KEY",
      `JWKS contains no encryption key (use="enc") with kid prefix "${prefix}".`,
    );
  }
  if (typeof chosen.alg !== "string" || chosen.alg.length === 0) {
    throw new AddToKlarnaError(
      "NO_MATCHING_KEY",
      `JWKS key ${chosen.kid} has no "alg" — cannot select a JWE key encryption algorithm.`,
    );
  }
  return chosen as JWK & { kid: string; alg: string };
}

function assertJwks(body: unknown): Jwks {
  if (!body || typeof body !== "object" || !("keys" in body)) {
    throw new AddToKlarnaError("JWKS_INVALID", "JWKS response is missing a `keys` array.");
  }
  const keys = (body as { keys: unknown }).keys;
  if (!Array.isArray(keys)) {
    throw new AddToKlarnaError("JWKS_INVALID", "JWKS `keys` is not an array.");
  }
  return { keys: keys as Jwks["keys"] };
}
