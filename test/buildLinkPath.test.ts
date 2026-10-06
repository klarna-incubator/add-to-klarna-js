import { describe, expect, it } from "@jest/globals";

import { buildLinkPath } from "../src/buildLinkPath.js";
import { AddToKlarnaError } from "../src/errors.js";
import { fromBase64Url } from "../src/utils.js";

const LINK_PATH = "/loyalty-cards-v2/add-to-klarna";
const JWE = "header.encrypted_key.iv.ciphertext.tag";

describe("buildLinkPath", () => {
  it("returns a path (not a full URL) suitable for AppsFlyer `deep_link_value`", () => {
    const path = buildLinkPath(LINK_PATH, "someBrandNickname", JWE);
    expect(path).toMatch(/^\/loyalty-cards-v2\/add-to-klarna\/someBrandNickname\/[A-Za-z0-9_-]+$/);
    expect(path.startsWith("/")).toBe(true);
    expect(path).not.toMatch(/^https?:/);
    expect(path).not.toMatch(/^klarna/);
  });

  it("wraps the JWE compact form in a base64url segment (so dots disappear)", () => {
    const path = buildLinkPath(LINK_PATH, "someBrandNickname", JWE);
    const tail = path.split("/").pop()!;
    expect(fromBase64Url(tail)).toBe(JWE);
    expect(tail).not.toMatch(/[+/=.]/);
  });

  it("percent-encodes the brandNickname segment", () => {
    const path = buildLinkPath(LINK_PATH, "brand-with-dash", JWE);
    expect(path).toContain("/add-to-klarna/brand-with-dash/");
  });

  it.each(["has space", "a/b", "a?b", "a#b"])("rejects an invalid brandNickname (%s)", (bad) => {
    expect(() => buildLinkPath(LINK_PATH, bad, JWE)).toThrow(AddToKlarnaError);
  });

  it("rejects an empty brandNickname", () => {
    expect(() => buildLinkPath(LINK_PATH, "", JWE)).toThrow(AddToKlarnaError);
  });

  it("rejects an empty JWE", () => {
    expect(() => buildLinkPath(LINK_PATH, "someBrandNickname", "")).toThrow(AddToKlarnaError);
  });
});
