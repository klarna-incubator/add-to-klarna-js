import { describe, expect, it } from "@jest/globals";

import { AddToKlarnaError, isAddToKlarnaError } from "../src/errors.js";

describe("AddToKlarnaError", () => {
  it("carries a stable code and message", () => {
    const err = new AddToKlarnaError("INVALID_INPUT", "bad");
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toBe("bad");
    expect(err.name).toBe("AddToKlarnaError");
  });

  it("supports a cause", () => {
    const root = new Error("root");
    const err = new AddToKlarnaError("JWKS_FETCH_FAILED", "wrapped", { cause: root });
    expect(err.cause).toBe(root);
  });

  it("is recognised by the type guard", () => {
    const err = new AddToKlarnaError("INVALID_INPUT", "x");
    expect(isAddToKlarnaError(err)).toBe(true);
    expect(isAddToKlarnaError(new Error("other"))).toBe(false);
    expect(isAddToKlarnaError(null)).toBe(false);
  });

  it("is an instance of Error", () => {
    const err = new AddToKlarnaError("INVALID_INPUT", "x");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AddToKlarnaError);
  });
});
