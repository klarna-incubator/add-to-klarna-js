// Sanity-check the built library against the live JWKS.
//
// Run after `yarn build`:
//
//     node examples/usage.mjs [inputId] [brandNickname] [region]
//
// Prints the generated universal link.

import { createAddToKlarnaClient } from "../dist/index.js";

// Merchant-side identifier for the loyalty card holder (e.g. card number).
// Encrypted client-side; only decrypted by Klarna server-side.
const inputId = process.argv[2] ?? "123-456";
// Klarna's canonical short identifier brand backing the loyalty program. u
// Issued by Klarna before the merchant can implement this functionality.
const brandNickname = process.argv[3] ?? "some-merchant-nickname";
// Klarna deployment region — selects which JWKS key is used (`eu`, `us`, `ap`).
const region = process.argv[4] ?? "eu";

const client = createAddToKlarnaClient({
  environment: "production",
  region,
});

const url = await client.buildLink({ brandNickname, inputId });
console.log(url);
