import { describe, expect, it } from "@jest/globals";

import { resolveConfig } from "../src/config.js";
import { AddToKlarnaError } from "../src/errors.js";

describe("resolveConfig", () => {
  it("resolves production / eu", () => {
    const config = resolveConfig({ environment: "production", region: "eu" });
    expect(config.jwksUrl).toBe("https://app.klarna.com/.well-known/jwks.json");
    expect(config.linkBaseUrl).toBe("https://app.klarna.com/loyalty-cards-v2/add-to-klarna");
    expect(config.region).toBe("eu");
  });

  it("defaults environment to production when omitted", () => {
    const config = resolveConfig({ region: "eu" });
    expect(config.jwksUrl).toBe("https://app.klarna.com/.well-known/jwks.json");
    expect(config.linkBaseUrl).toBe("https://app.klarna.com/loyalty-cards-v2/add-to-klarna");
  });

  it("selects the staging JWKS endpoint and the dev scheme for staging", () => {
    const config = resolveConfig({ environment: "staging", region: "us" });
    expect(config.jwksUrl).toMatch(/^https:\/\/.+\/\.well-known\/jwks\.json$/);
    expect(config.jwksUrl).not.toBe("https://app.klarna.com/.well-known/jwks.json");
    expect(config.linkBaseUrl).toBe("klarnadev://loyalty-cards-v2/add-to-klarna");
    expect(config.region).toBe("us");
  });

  it("JWKS URL does not change with region (region only picks the key)", () => {
    const a = resolveConfig({ environment: "production", region: "eu" });
    const b = resolveConfig({ environment: "production", region: "us" });
    const c = resolveConfig({ environment: "production", region: "ap" });
    expect(a.jwksUrl).toBe(b.jwksUrl);
    expect(b.jwksUrl).toBe(c.jwksUrl);
  });

  it("link base URL does not change with region", () => {
    const a = resolveConfig({ environment: "production", region: "eu" });
    const b = resolveConfig({ environment: "production", region: "us" });
    const c = resolveConfig({ environment: "production", region: "ap" });
    expect(a.linkBaseUrl).toBe(b.linkBaseUrl);
    expect(b.linkBaseUrl).toBe(c.linkBaseUrl);
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
});
