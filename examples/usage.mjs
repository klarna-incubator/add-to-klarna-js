// Sanity-check the built library against the live JWKS.
//
// Run after `yarn build`:
//
//     node examples/usage.mjs [inputId] [brandNickname] [region]
//
// Prints the generated universal link.

import { createAddToKlarnaClient } from "../dist/index.js";

const inputId = process.argv[2] ?? "123-456";
const brandNickname = process.argv[3] ?? "some-merchant-nickname";
const region = process.argv[4] ?? "eu";

const client = createAddToKlarnaClient({
  environment: "production",
  region,
});

const url = await client.buildLink({ brandNickname, inputId });
console.log(url);
