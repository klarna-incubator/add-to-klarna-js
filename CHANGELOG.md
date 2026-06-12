# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - yyyy-mm-dd

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
[unreleased]: https://github.com/klarna-incubator/add-to-klarna-js/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/klarna-incubator/add-to-klarna-js/releases/tag/v1.0.0
