/**
 * Stable error codes. Merchant integrations should branch on these, not on
 * the human-readable message.
 */
export type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CONFIG"
  | "JWKS_FETCH_FAILED"
  | "JWKS_INVALID"
  | "NO_MATCHING_KEY"
  | "ENCRYPTION_FAILED"
  | "NAVIGATION_UNAVAILABLE";

/**
 * The single error type thrown by every public API in this package. Always
 * carries a stable {@link ErrorCode} on `code` and, where relevant, the
 * underlying error on `cause`.
 */
export class AddToKlarnaError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AddToKlarnaError";
    this.code = code;
    // Restore prototype chain for ES5-targeted bundles. No-op on modern targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isAddToKlarnaError(err: unknown): err is AddToKlarnaError {
  return err instanceof AddToKlarnaError;
}
