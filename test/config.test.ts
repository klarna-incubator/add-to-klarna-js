import { describe, expect, it } from "@jest/globals";

import { resolveConfig } from "../src/config.js";
import { AddToKlarnaError } from "../src/errors.js";

describe("resolveConfig", () => {
  it("resolves production / pink / eu", () => {
    const config = resolveConfig({ environment: "production", clientTarget: "pink", region: "eu" });
    expect(config.jwksUrl).toBe("https://app.klarna.com/.well-known/jwks.json");
    expect(config.linkPath).toBe("/loyalty-cards-v2/add-to-klarna");
    expect(config.oneLinkBaseUrl).toBe("https://l.klarna.com/22XC");
    expect(config.mediaSource).toBe("WebApp");
    expect(config.campaignName).toBe("add-to-klarna");
    expect(config.region).toBe("eu");
    expect(config.desktopFallbackUrl).toBe("https://klarna.com/add-to-klarna");
  });

  it("defaults environment and target to production /pink when omitted", () => {
    const config = resolveConfig({ region: "eu" });
    expect(config.jwksUrl).toBe("https://app.klarna.com/.well-known/jwks.json");
    expect(config.linkPath).toBe("/loyalty-cards-v2/add-to-klarna");
    expect(config.oneLinkBaseUrl).toBe("https://l.klarna.com/22XC");
    expect(config.mediaSource).toBe("WebApp");
    expect(config.campaignName).toBe("add-to-klarna");
    expect(config.region).toBe("eu");
    expect(config.desktopFallbackUrl).toBe("https://klarna.com/add-to-klarna");
  });

  it("selects the staging JWKS endpoint and the staging AppsFlyer OneLink", () => {
    const config = resolveConfig({ environment: "staging", clientTarget: "staging", region: "us" });
    expect(config.jwksUrl).toMatch(/^https:\/\/.+\/\.well-known\/jwks\.json$/);
    expect(config.jwksUrl).not.toBe("https://app.klarna.com/.well-known/jwks.json");
    expect(config.oneLinkBaseUrl).toBe("https://klarnastaging.onelink.me/hV1K");
    expect(config.region).toBe("us");
    expect(config.desktopFallbackUrl).toBe("https://klarna.com/add-to-klarna");
  });

  it("does not switch OneLink host or desktop fallback from environment=staging alone", () => {
    const config = resolveConfig({ environment: "staging", region: "eu" });
    expect(config.jwksUrl).not.toBe("https://app.klarna.com/.well-known/jwks.json");
    expect(config.oneLinkBaseUrl).toBe("https://l.klarna.com/22XC");
    expect(config.desktopFallbackUrl).toBe("https://klarna.com/add-to-klarna");
  });

  it("JWKS URL does not change with region (region only picks the key)", () => {
    const a = resolveConfig({ environment: "production", region: "eu" });
    const b = resolveConfig({ environment: "production", region: "us" });
    const c = resolveConfig({ environment: "production", region: "ap" });
    expect(a.jwksUrl).toBe(b.jwksUrl);
    expect(b.jwksUrl).toBe(c.jwksUrl);
  });

  it("OneLink base URL and link path do not change with region", () => {
    const a = resolveConfig({ environment: "production", region: "eu" });
    const b = resolveConfig({ environment: "production", region: "us" });
    const c = resolveConfig({ environment: "production", region: "ap" });
    expect(a.oneLinkBaseUrl).toBe(b.oneLinkBaseUrl);
    expect(b.oneLinkBaseUrl).toBe(c.oneLinkBaseUrl);
    expect(a.linkPath).toBe(b.linkPath);
    expect(b.linkPath).toBe(c.linkPath);
  });

  it("accepts the ap region", () => {
    const config = resolveConfig({ environment: "production", region: "ap" });
    expect(config.region).toBe("ap");
  });

  it("rejects an unknown environment", () => {
    expect(() =>
      resolveConfig({
        environment: "dev" as unknown as "staging",
        region: "eu",
      }),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects an unknown region", () => {
    expect(() =>
      resolveConfig({
        environment: "production",
        region: "asia" as unknown as "eu",
      }),
    ).toThrow(AddToKlarnaError);
  });

  it("rejects an unknown clientTarget", () => {
    expect(() =>
      resolveConfig({
        environment: "production",
        clientTarget: "dev" as unknown as "pink",
        region: "eu",
      }),
    ).toThrow(AddToKlarnaError);
  });
});
