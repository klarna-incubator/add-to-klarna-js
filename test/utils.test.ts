import { describe, expect, it } from "@jest/globals";

import { fromBase64Url, toBase64Url } from "../src/utils.js";

describe("toBase64Url / fromBase64Url", () => {
  it("round-trips ASCII", () => {
    const input = "hello world";
    expect(fromBase64Url(toBase64Url(input))).toBe(input);
  });

  it("round-trips multi-byte UTF-8", () => {
    const input = "Klarna · åäö · 🎉";
    expect(fromBase64Url(toBase64Url(input))).toBe(input);
  });

  it("emits URL-safe characters only", () => {
    const input = "?".repeat(64) + "<>&";
    const encoded = toBase64Url(input);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("matches a known reference vector", () => {
    expect(toBase64Url("hello")).toBe("aGVsbG8");
  });
});
