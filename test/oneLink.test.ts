import { describe, expect, it } from "@jest/globals";

import { AddToKlarnaError } from "../src/errors.js";
import { buildOneLinkUrl, type BuildOneLinkInput } from "../src/oneLink.js";

const VALID_INPUT: BuildOneLinkInput = {
  oneLinkBaseUrl: "https://l.klarna.com/22XC",
  pid: "WebApp",
  c: "add-to-klarna",
  deepLinkValue: "/loyalty-cards-v2/add-to-klarna/someBrand/abc123",
  webFallbackUrl: "https://www.klarna.com/download",
};

/**
 * Assert that a thunk throws an {@link AddToKlarnaError} with the given code.
 * Kept as a local helper (rather than a custom Jest matcher) so the test file
 * stays free of module-augmentation quirks under ts-jest ESM.
 */
function expectErrorCode(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(AddToKlarnaError);
  expect(caught).toMatchObject({ code });
}

describe("buildOneLinkUrl", () => {
  it("composes the expected AppsFlyer OneLink URL", () => {
    const url = buildOneLinkUrl(VALID_INPUT);

    expect(url.startsWith("https://l.klarna.com/22XC?")).toBe(true);

    const parsed = new URL(url);
    expect(parsed.searchParams.get("pid")).toBe("WebApp");
    expect(parsed.searchParams.get("c")).toBe("add-to-klarna");
    expect(parsed.searchParams.get("deep_link_value")).toBe(
      "/loyalty-cards-v2/add-to-klarna/someBrand/abc123",
    );
    expect(parsed.searchParams.get("af_web_dp")).toBe("https://www.klarna.com/download");
  });

  it("URL-encodes each param value (slashes in deep_link_value; `:` in af_web_dp)", () => {
    const url = buildOneLinkUrl(VALID_INPUT);

    expect(url).toContain(
      "deep_link_value=" + encodeURIComponent("/loyalty-cards-v2/add-to-klarna/someBrand/abc123"),
    );
    expect(url).toContain("af_web_dp=" + encodeURIComponent("https://www.klarna.com/download"));
  });

  it("emits params in a stable order for snapshot-friendly output", () => {
    const url = buildOneLinkUrl(VALID_INPUT);
    const query = url.slice(url.indexOf("?") + 1);
    const keys = query.split("&").map((p) => p.split("=")[0]);
    expect(keys).toEqual(["pid", "c", "deep_link_value", "af_web_dp"]);
  });

  it.each<[string, string]>([
    ["pink", "https://l.klarna.com/22XC"],
    ["internalpink", "https://klarnainternalpink.onelink.me/lXgD"],
    ["yellow", "https://klarnayellow.onelink.me/JQ8X"],
    ["staging", "https://klarnastaging.onelink.me/hV1K"],
    ["oneoff", "https://klarnaoneoff.onelink.me/FaEr"],
    ["local", "https://klarnalocal.onelink.me/dxUs"],
  ])(
    "preserves the %s clientTarget oneLinkBaseUrl verbatim in the composed URL",
    (_target, base) => {
      const url = buildOneLinkUrl({ ...VALID_INPUT, oneLinkBaseUrl: base });
      expect(url.startsWith(`${base}?`)).toBe(true);
    },
  );

  describe("validation", () => {
    it("rejects an empty oneLinkBaseUrl with INVALID_CONFIG", () => {
      expectErrorCode(
        () => buildOneLinkUrl({ ...VALID_INPUT, oneLinkBaseUrl: "" }),
        "INVALID_CONFIG",
      );
    });

    it("rejects an empty pid with INVALID_CONFIG", () => {
      expectErrorCode(() => buildOneLinkUrl({ ...VALID_INPUT, pid: "" }), "INVALID_CONFIG");
    });

    it("rejects an empty c with INVALID_CONFIG", () => {
      expectErrorCode(() => buildOneLinkUrl({ ...VALID_INPUT, c: "" }), "INVALID_CONFIG");
    });

    it("rejects an empty deepLinkValue with INVALID_INPUT", () => {
      expectErrorCode(
        () => buildOneLinkUrl({ ...VALID_INPUT, deepLinkValue: "" }),
        "INVALID_INPUT",
      );
    });

    it.each<[string, Partial<BuildOneLinkInput>]>([
      ["webFallbackUrl (empty)", { webFallbackUrl: "" }],
      ["webFallbackUrl (malformed)", { webFallbackUrl: "not a url" }],
      ["webFallbackUrl (custom scheme)", { webFallbackUrl: "klarna://download" }],
    ])("rejects invalid %s with INVALID_CONFIG", (_name, override) => {
      expectErrorCode(() => buildOneLinkUrl({ ...VALID_INPUT, ...override }), "INVALID_CONFIG");
    });
  });
});
