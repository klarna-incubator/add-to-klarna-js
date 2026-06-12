import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { AddToKlarnaError } from "../src/errors.js";
import { buildPayload } from "../src/buildPayload.js";

describe("buildPayload", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    jest
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("11111111-1111-4111-8111-111111111111");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("builds a payload with inputId, linkId and iat", () => {
    expect(buildPayload("merchant-123")).toEqual({
      inputId: "merchant-123",
      linkId: "11111111-1111-4111-8111-111111111111",
      iat: 1_700_000_000,
    });
  });

  it("floors iat to whole seconds", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_999);
    expect(buildPayload("x").iat).toBe(1_700_000_000);
  });

  it("mints a fresh linkId on every call (when not mocked)", () => {
    jest.restoreAllMocks();
    const a = buildPayload("x");
    const b = buildPayload("x");
    expect(a.linkId).not.toBe(b.linkId);
  });

  it("rejects an empty inputId", () => {
    expect(() => buildPayload("")).toThrow(AddToKlarnaError);
  });

  it("rejects a non-string inputId", () => {
    expect(() => buildPayload(123 as unknown as string)).toThrow(AddToKlarnaError);
  });
});
