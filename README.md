# @klarna/add-to-klarna

> Merchant integration library for generating Klarna "Add to Klarna" AppsFlyer OneLinks.

[![Build Status][ci-image]][ci-url]
[![License][license-image]][license-url]
[![Developed at Klarna][klarna-image]][klarna-url]

Lets a merchant page turn a `brandNickname` + `inputId` into a fully encrypted Klarna AppsFlyer OneLink in one call, without the merchant having to touch JWE, JWKS, key rotation, or URL encoding.

## Install

```bash
yarn add @klarna/add-to-klarna
# or
npm install @klarna/add-to-klarna
```

The package is isomorphic. It works in:

- modern browsers (uses Web Crypto + `fetch`),
- Node ≥ 20 (uses the built-in Web Crypto and global `fetch`).

It has a single runtime dependency: [`jose`](https://github.com/panva/jose).

## Quick start

```ts
import { createAddToKlarnaClient } from "@klarna/add-to-klarna";

const klarna = createAddToKlarnaClient({ region: "eu" });

document.querySelector("#add-to-klarna-button")?.addEventListener("click", async () => {
  await klarna.redirect({
    brandNickname: "your-brand-nickname",
    inputId: "your-customer-id",
  });
});
```

`redirect()` calls `window.location.assign(...)` with the generated link. If
you want the URL without navigating (e.g. to put in an `<a href>` or to send
in an email from a server), use `buildLink()`:

```ts
const url = await klarna.buildLink({
  brandNickname: "your-brand-nickname",
  inputId: "your-customer-id",
});
```

## Without a build step

The published package also works without a bundler.

### Node (CommonJS)

The package ships both ESM and CJS entry points, so `require` works the same
as `import`:

```js
const { createAddToKlarnaClient } = require("@klarna/add-to-klarna");

const klarna = createAddToKlarnaClient({ region: "eu" });

(async () => {
  const url = await klarna.buildLink({
    brandNickname: "your-brand-nickname",
    inputId: "your-customer-id",
  });
  console.log(url);
})();
```

### Browser (`<script type="module">` from a CDN)

Drop the library straight into an HTML page via an ESM-aware CDN — no
`npm`, no bundler:

```html
<script type="module">
  import { createAddToKlarnaClient } from "https://esm.sh/@klarna/add-to-klarna@2.0.0";

  const klarna = createAddToKlarnaClient({ region: "eu" });

  document.querySelector("#add-to-klarna-button")?.addEventListener("click", async () => {
    await klarna.redirect({
      brandNickname: "your-brand-nickname",
      inputId: "your-customer-id",
    });
  });
</script>
```

`esm.sh` (above), `https://cdn.jsdelivr.net/npm/@klarna/add-to-klarna@2.0.0/+esm`,
and `https://unpkg.com/@klarna/add-to-klarna@2.0.0?module` all serve the
ESM build and resolve the `jose` dependency transparently. Always pin a
version in production so a future release can't change behaviour under
your page.

## Configuration

Only `region` is required. `environment` defaults to `"production"` and
`clientTarget` defaults to `"pink"` — the public production Klarna app —
so a merchant integration can usually pass just the region.

| Option         | Type                                                                       | Default        | Description                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment`  | `"production" \| "staging"`                                                | `"production"` | Which Klarna backend to target. Picks the JWKS endpoint. Desktop fallback is the same production page for every environment.                                           |
| `clientTarget` | `"pink" \| "internalpink" \| "yellow" \| "staging" \| "oneoff" \| "local"` | `"pink"`       | Which Klarna client application to target. Picks the AppsFlyer OneLink base URL. Merchants should leave this at `"pink"`; the other values are Klarna-internal builds. |
| `region`       | `"eu" \| "us" \| "ap"`                                                     | _(required)_   | Which deployment region to target. Picks the key inside the JWKS via a `kid-{region}-` prefix.                                                                         |

`environment` and `clientTarget` are independent by design: internal builds
of the Klarna app (`yellow`, `oneoff`, `local`, …) can point at either the
production or the staging backend, so the JWKS host and the AppsFlyer host
are configured separately.

There are no other knobs — by design. The clock, the UUID generator, and
the `fetch` implementation are all fixed (the library uses
`globalThis.fetch`, `Date.now`, and `globalThis.crypto.randomUUID`).

## URL shape

The library emits an [AppsFlyer OneLink](https://support.appsflyer.com/hc/en-us/articles/207032246-OneLink-link-management) URL that routes based on the device:

- **Mobile with the Klarna app installed** — opens the app to the add-to-klarna deep link.
- **Mobile without the app** — AppsFlyer routes to the App Store / Play Store per the OneLink template configuration and replays the deep link after install (deferred deep linking).
- **Desktop** — falls back to `https://klarna.com/add-to-klarna` (`af_web_dp`).

The composed URL has the shape:

```
<oneLinkBase>?pid=WebApp
  &c=add-to-klarna
  &deep_link_value=<url-encoded /loyalty-cards-v2/add-to-klarna/<brandNickname>/<encryptedPayload>>
  &af_web_dp=<desktop fallback URL>
```

The `<oneLinkBase>` is fixed per `clientTarget`:

| `clientTarget` | OneLink base URL                             |
| -------------- | -------------------------------------------- |
| `pink`         | `https://l.klarna.com/22XC`                  |
| `internalpink` | `https://klarnainternalpink.onelink.me/lXgD` |
| `yellow`       | `https://klarnayellow.onelink.me/JQ8X`       |
| `staging`      | `https://klarnastaging.onelink.me/hV1K`      |
| `oneoff`       | `https://klarnaoneoff.onelink.me/FaEr`       |
| `local`        | `https://klarnalocal.onelink.me/dxUs`        |

The library only sets `af_web_dp` (the desktop fallback) on the URL itself.
The App Store / Play Store fallbacks for mobile are configured on the
AppsFlyer OneLink template, not on the URL. Desktop fallback is always
`https://klarna.com/add-to-klarna` — the same production page for every
`environment` and `clientTarget`. Merchants don't (and can't) configure it.
This keeps the merchant API surface identical to v1: just `brandNickname`
and `inputId`.

The `<encryptedPayload>` inside `deep_link_value` is the JWE compact serialization wrapped in an extra base64url so the entire ciphertext fits in a single deep-link path component (the dots in the JWE compact form would otherwise break the Klarna app's in-app router).

## API

### `createAddToKlarnaClient(options)`

Returns an `AddToKlarnaClient`. Construction is cheap and synchronous; the
first network call happens on the first `buildLink` / `redirect`.

### `client.buildLink({ brandNickname, inputId })`

Returns `Promise<string>` — the fully-formed AppsFlyer OneLink URL.

A fresh `linkId` is minted on every call (and embedded inside the encrypted
payload, not exposed on the surface). The Klarna backend enforces single-use
semantics, so do **not** cache the returned URL — generate a new one per
click.

### `client.redirect({ brandNickname, inputId })`

Calls `buildLink()` and then `window.location.assign(url)`. Throws
`AddToKlarnaError` with `code: "NAVIGATION_UNAVAILABLE"` if `window` is not
present.

## Caching

The library does **not** maintain any in-memory cache. Every `buildLink`
re-fetches the JWKS. Caching is delegated to the HTTP layer:

- the production JWKS is served from `app.klarna.com` through Klarna's CDN,
  which sets the `Cache-Control` policy authoritatively;
- the browser's HTTP cache (or Node's fetch cache, where configured) honors
  those headers on subsequent calls.

This means a key rotation propagates as soon as the CDN edge cache expires —
no client release required.

## Key selection by region

Both published JWKS files contain keys for every region. Each key is
namespaced by its `kid`, which always starts with `kid-{region}-`:

```
kid-eu-66caf84b-…
kid-us-…
kid-ap-…
```

`region` in the client options decides which prefix the library filters for.
A region with no matching key in the JWKS produces a typed
`NO_MATCHING_KEY` error rather than silently picking the wrong region.

## Security model

The JWKS is fetched over HTTPS from `app.klarna.com`; certificate
validation is delegated to Web PKI + HSTS. The library doesn't ship
custom cert pinning — no portable browser API for it, and the cost of
rotating a pin across every merchant integration outweighs the marginal
protection.

The JWE profile is pinned end-to-end instead:

| Field | Pinned value     |
| ----- | ---------------- |
| `use` | `enc`            |
| `alg` | `ECDH-ES+A256KW` |
| `kty` | `EC`             |
| `crv` | `P-256`          |
| `enc` | `A256GCM`        |

Any JWKS key not matching this tuple is rejected with `NO_MATCHING_KEY`,
so drift or a substituted JWKS fails closed rather than silently
downgrading.

## Errors

Every failure surfaces as an `AddToKlarnaError` with a stable `.code`. Branch
on the code, not on the message.

| Code                     | Meaning                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_CONFIG`         | A client option was invalid (e.g. unknown `environment`, `clientTarget` or `region`).                                        |
| `INVALID_INPUT`          | Missing / malformed `brandNickname` or `inputId`.                                                                            |
| `JWKS_FETCH_FAILED`      | Could not reach the JWKS endpoint, or the endpoint returned a non-2xx HTTP status.                                           |
| `JWKS_INVALID`           | The JWKS body was not valid JSON, or did not contain a `keys` array.                                                         |
| `NO_MATCHING_KEY`        | The JWKS contains no key with the `kid-{region}-` prefix matching the pinned `alg`/`kty`/`crv` tuple (see _Security model_). |
| `ENCRYPTION_FAILED`      | The JWE could not be produced (key import or encryption step threw).                                                         |
| `NAVIGATION_UNAVAILABLE` | `redirect()` was called outside a browser context.                                                                           |

```ts
import { AddToKlarnaError, isAddToKlarnaError } from "@klarna/add-to-klarna";

try {
  await klarna.redirect({ brandNickname, inputId });
} catch (err) {
  if (isAddToKlarnaError(err) && err.code === "JWKS_FETCH_FAILED") {
    // Show a connectivity error UI.
  } else {
    throw err;
  }
}
```

## Development setup

```bash
yarn install
yarn test         # jest, one shot
yarn test:watch   # jest, watch mode
yarn typecheck    # tsc --noEmit
yarn lint
yarn build        # tsup → ESM + CJS + .d.ts in dist/
```

Tests use [Jest](https://jestjs.io/) with `ts-jest`'s ESM preset. They mock
`globalThis.fetch`, `Date.now` and `globalThis.crypto.randomUUID` via
`jest.spyOn` / `jest.fn` rather than relying on dependency injection.

## Release History

See our [changelog](CHANGELOG.md).

## License

Copyright © 2026 Klarna Bank AB

Licensed under the [Apache License, Version 2.0](./LICENSE). For license details, see the [LICENSE](LICENSE) file in the root of this project.

<!-- Markdown link & img dfn's -->

[ci-image]: https://img.shields.io/badge/build-passing-brightgreen?style=flat-square
[ci-url]: https://github.com/klarna-incubator/TODO
[license-image]: https://img.shields.io/badge/license-Apache%202-blue?style=flat-square
[license-url]: http://www.apache.org/licenses/LICENSE-2.0
[klarna-image]: https://img.shields.io/badge/%20-Developed%20at%20Klarna-black?style=flat-square&labelColor=ffb3c7&logo=klarna&logoColor=black
[klarna-url]: https://klarna.github.io
