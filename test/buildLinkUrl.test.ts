import { describe, expect, it } from "@jest/globals";

import { AddToKlarnaError } from "../src/errors.js";
import { buildLinkUrl } from "../src/buildLinkUrl.js";
import { fromBase64Url } from "../src/utils.js";

const PROD_BASE = "https://app.klarna.com/loyalty-cards-v2/add-to-klarna";
const STAGING_BASE = "klarnadev://loyalty-cards-v2/add-to-klarna";
const JWE = "header.encrypted_key.iv.ciphertext.tag";

describe("buildLinkUrl (production base)", () => {
  it("builds the production universal-link shape", () => {
    const url = buildLinkUrl(PROD_BASE, "someBrandNickname", JWE);
    expect(url).toMatch(
      /^https:\/\/app\.klarna\.com\/loyalty-cards-v2\/add-to-klarna\/someBrandNickname\/[A-Za-z0-9_-]+$/,
    );
  });

  it("wraps the JWE compact form in a base64url segment (so dots disappear)", () => {
    const url = buildLinkUrl(PROD_BASE, "someBrandNickname", JWE);
    const tail = url.split("/").pop()!;
    expect(fromBase64Url(tail)).toBe(JWE);
    expect(tail).not.toMatch(/[+/=.]/);
  });

  it("percent-encodes the brandNickname", () => {
    const url = buildLinkUrl(PROD_BASE, "brand-with-dash", JWE);
    expect(url).toContain("/add-to-klarna/brand-with-dash/");
  });

  it.each(["has space", "a/b", "a?b", "a#b"])("rejects an invalid brandNickname (%s)", (bad) => {
    expect(() => buildLinkUrl(PROD_BASE, bad, JWE)).toThrow(AddToKlarnaError);
  });

  it("rejects an empty brandNickname", () => {
    expect(() => buildLinkUrl(PROD_BASE, "", JWE)).toThrow(AddToKlarnaError);
  });

  it("rejects an empty JWE", () => {
    expect(() => buildLinkUrl(PROD_BASE, "someBrandNickname", "")).toThrow(AddToKlarnaError);
  });
});

describe("buildLinkUrl (staging custom scheme)", () => {
  it("preserves the klarnadev:// scheme verbatim", () => {
    const url = buildLinkUrl(STAGING_BASE, "someBrandNickname", JWE);
    expect(url.startsWith("klarnadev://loyalty-cards-v2/add-to-klarna/someBrandNickname/")).toBe(
      true,
    );
  });
});
