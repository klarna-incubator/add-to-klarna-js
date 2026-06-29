# @klarna/add-to-klarna

> Merchant integration library for generating Klarna "Add to Klarna" universal links.

[![Build Status][ci-image]][ci-url]
[![License][license-image]][license-url]
[![Developed at Klarna][klarna-image]][klarna-url]

Lets a merchant page turn a `brandNickname` + `inputId` into a fully encrypted Klarna universal link in one call, without the merchant having to touch JWE, JWKS, key rotation, or URL encoding.

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
  import { createAddToKlarnaClient } from "https://esm.sh/@klarna/add-to-klarna@1.0.0";

  const klarna = createAddToKlarnaClient({ region: "eu" });

  document.querySelector("#add-to-klarna-button")?.addEventListener("click", async () => {
    await klarna.redirect({
      brandNickname: "your-brand-nickname",
      inputId: "your-customer-id",
    });
  });
</script>
```

`esm.sh` (above), `https://cdn.jsdelivr.net/npm/@klarna/add-to-klarna@1.0.0/+esm`,
and `https://unpkg.com/@klarna/add-to-klarna@1.0.0?module` all serve the
ESM build and resolve the `jose` dependency transparently. Always pin a
version in production so a future release can't change behaviour under
your page.

## Configuration

Just two options. Only `region` is required — `environment` defaults to
`"production"`, so a merchant integration can usually pass just the region.

| Option        | Type                        | Default        | Description                                                                                      |
| ------------- | --------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `environment` | `"production" \| "staging"` | `"production"` | Which Klarna deployment to target. Picks both the JWKS endpoint and the universal-link base URL. |
| `region`      | `"eu" \| "us" \| "ap"`      | _(required)_   | Which deployment region to target. Picks the key inside the JWKS via a `kid-{region}-` prefix.   |

That's it. There are no other knobs — by design. The JWKS endpoint, the
universal-link host, the clock, the UUID generator, and the `fetch`
implementation are all fixed (the library uses `globalThis.fetch`,
`Date.now`, and `globalThis.crypto.randomUUID`).

## URL shape

The library always emits a URL of this shape:

```
<base>/<brandNickname>/<base64UrlEncodedPayload>
```

The `<base>` is fixed per environment (and already contains the
`/add-to-klarna` route segment):

| Environment  | Base URL                                                |
| ------------ | ------------------------------------------------------- |
| `production` | `https://app.klarna.com/loyalty-cards-v2/add-to-klarna` |
| `staging`    | `klarnadev://loyalty-cards-v2/add-to-klarna`            |

The `<base64UrlEncodedPayload>` is the JWE compact serialization wrapped in an
extra base64url so the entire ciphertext fits in a single URL path component.

## API

### `createAddToKlarnaClient(options)`

Returns an `AddToKlarnaClient`. Construction is cheap and synchronous; the
first network call happens on the first `buildLink` / `redirect`.

### `client.buildLink({ brandNickname, inputId })`

Returns `Promise<string>` — the fully-formed universal link URL.

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
| `INVALID_CONFIG`         | A client option was invalid (e.g. unknown `environment` or `region`).                                                        |
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
