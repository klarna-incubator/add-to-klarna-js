# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-22

### Changed (breaking)

- `client.buildLink()` / `client.redirect()` now emit an AppsFlyer OneLink
  URL that wraps the encrypted add-to-klarna deep link, instead of a
  universal link pointing straight at `app.klarna.com`. On mobile with the
  Klarna app installed the app opens directly; without the app AppsFlyer
  routes to the App Store / Play Store (configured on the OneLink template,
  not on the URL) and replays the deep link after install (deferred deep
  linking). On desktop the URL sets `af_web_dp` to
  `https://klarna.com/add-to-klarna`.
- The merchant API surface is unchanged for existing integrations: still
  `{ brandNickname, inputId }` in, single URL out. The desktop-fallback URL
  is the same production page for every `environment` and `clientTarget`.
- Staging now routes through the Klarna staging AppsFlyer OneLink
  (`https://klarnastaging.onelink.me/hV1K`) instead of the `klarnadev://`
  custom scheme. Select it explicitly via `clientTarget: "staging"` (see
  below); passing `environment: "staging"` alone no longer implies the
  staging AppsFlyer host.

### Added

- New `clientTarget` client option (`"pink" | "internalpink" | "yellow" | "staging" | "oneoff" | "local"`, defaulting to `"pink"` — the public production Klarna app).
  Selects which AppsFlyer OneLink base URL the library composes on top of.
  Independent of `environment`, so internal Klarna builds (`yellow`,
  `oneoff`, `local`, …) can target either backend. Merchant integrations
  should leave this at the default.
- `src/oneLink.ts` — `buildOneLinkUrl()` composes the AppsFlyer OneLink URL.
  Adapted from the internal `@klarna/link-generator` `generateGeneralLink`
  flow, cut down to just the subset add-to-klarna needs and re-written to
  use hand-rolled validation (throwing `AddToKlarnaError`) rather than
  `zod`, to avoid adding a runtime dependency.

## [1.0.0] - 2026-06-15

### Added

- Initial release of `@klarna/add-to-klarna`.
- `createAddToKlarnaClient({ region, environment })` factory with support for
  `eu` / `us` / `ap` regions and `production` / `staging` environments.
- `client.buildLink({ brandNickname, inputId })` to produce a fully-formed,
  JWE-encrypted Klarna universal link.
- `client.redirect({ brandNickname, inputId })` to navigate the browser
  directly to the generated link.
- Region-aware JWKS key selection via the `kid-{region}-` prefix.
- Typed `AddToKlarnaError` with stable `.code` values
  (`INVALID_CONFIG`, `INVALID_INPUT`, `JWKS_FETCH_FAILED`, `JWKS_INVALID`,
  `NO_MATCHING_KEY`, `ENCRYPTION_FAILED`, `NAVIGATION_UNAVAILABLE`) and an
  `isAddToKlarnaError` type guard.
- Dual ESM + CJS build with TypeScript declarations, isomorphic for modern
  browsers and Node ≥ 20.

<!-- Markdown link dfn's -->

[unreleased]: https://github.com/klarna-incubator/add-to-klarna-js/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/klarna-incubator/add-to-klarna-js/releases/tag/v2.0.0
[1.0.0]: https://github.com/klarna-incubator/add-to-klarna-js/releases/tag/v1.0.0
