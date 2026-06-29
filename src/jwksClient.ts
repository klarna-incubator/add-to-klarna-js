import type { JWK } from "jose";

import { ALG } from "./encryptJwe.js";
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
 * The single key shape this library accepts off the JWKS. Pinned to the
 * tuple Klarna's backend publishes today:
 *
 *     alg = ECDH-ES+A256KW
 *     kty = EC
 *     crv = P-256
 *
 * Anything else is rejected with `NO_MATCHING_KEY`, so a JWKS that ever
 * drifts off this profile — whether by mistake or because someone
 * managed to substitute it past TLS — fails closed instead of
 * silently using a weaker or symmetric algorithm. Any change to this
 * tuple is an SDK-coordinated event with the backend.
 */
const REQUIRED_KTY = "EC";
const REQUIRED_CRV = "P-256";

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
 * A key is usable iff it declares all of:
 *
 *   - `use === "enc"`
 *   - `kid` starting with `kid-{region}-`
 *   - `alg === ALG`, `kty === "EC"`, `crv === "P-256"` (see file header)
 *
 * If multiple keys match, the first one in document order wins — the JWKS
 * is published with the most recent key first. Throws `NO_MATCHING_KEY`
 * when nothing matches.
 */
export function pickEncryptionKey(jwks: Jwks, region: Region): JWK & { kid: string } {
  const prefix = `kid-${region}-`;
  const chosen = jwks.keys.find(
    (k) =>
      k.use === "enc" &&
      typeof k.kid === "string" &&
      k.kid.startsWith(prefix) &&
      k.alg === ALG &&
      k.kty === REQUIRED_KTY &&
      k.crv === REQUIRED_CRV,
  );

  if (!chosen || typeof chosen.kid !== "string") {
    throw new AddToKlarnaError(
      "NO_MATCHING_KEY",
      `JWKS contains no usable encryption key with kid prefix "${prefix}" ` +
        `(need use="enc", alg="${ALG}", kty="${REQUIRED_KTY}", crv="${REQUIRED_CRV}").`,
    );
  }
  return chosen as JWK & { kid: string };
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
