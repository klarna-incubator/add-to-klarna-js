import { jest } from "@jest/globals";
import { exportJWK, generateKeyPair, type CryptoKey, type JWK } from "jose";

/**
 * A test JWKS shape — just enough to drive {@link fetchJwks}.
 */
export interface TestJwks {
  keys: Array<JWK & { kid: string; alg: string; use?: string }>;
}

export interface TestKeypair {
  jwks: TestJwks;
  publicJwk: JWK & { kid: string; alg: string; use: "enc" };
  privateKey: CryptoKey;
  kid: string;
  alg: string;
}

/**
 * Generate a fresh keypair and assemble a JWKS that exposes its public half.
 * Defaults to the pinned production profile (ECDH-ES+A256KW over EC P-256).
 * Used by every test that needs to round-trip through real crypto rather
 * than mocking out the encryptor.
 */
export async function generateTestKeypair(
  kid = "kid-test-eu-1",
  alg = "ECDH-ES+A256KW",
): Promise<TestKeypair> {
  const { publicKey, privateKey } = await generateKeyPair(alg, { extractable: true });
  const publicJwk = {
    ...(await exportJWK(publicKey)),
    kid,
    alg,
    use: "enc" as const,
  };
  return {
    jwks: { keys: [publicJwk] },
    publicJwk,
    privateKey,
    kid,
    alg,
  };
}

/**
 * Pull the encrypted-payload segment out of a built link.
 */
export function extractEncryptedPayload(url: string): string {
  const tail = url.split("/").pop();
  if (!tail) throw new Error(`URL has no trailing segment: ${url}`);
  return tail;
}

/**
 * Replace `globalThis.fetch` with a Jest mock that returns the given JWKS
 * body. Returns the mock so tests can assert on call counts / arguments.
 */
export function mockFetchReturning(jwks: unknown): jest.Mock {
  const mock = jest.fn(async () => {
    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  (globalThis as { fetch: unknown }).fetch = mock;
  return mock;
}
