/**
 * Minimal merchant integration snippet.
 *
 * Compile-only example — this file is not executed by the package's scripts.
 * It exists so you can copy-paste a working call site into a merchant codebase
 * and have TypeScript validate it for you.
 */
import { AddToKlarnaError, createAddToKlarnaClient } from "../src/index.js";

const client = createAddToKlarnaClient({
  region: "eu",
});

document.querySelector("#add-to-klarna")?.addEventListener("click", async () => {
  try {
    await client.redirect({
      brandNickname: "your-brand-nickname",
      inputId: "your-customer-id",
    });
  } catch (err) {
    if (err instanceof AddToKlarnaError) {
      console.error(`Add to Klarna failed (${err.code}):`, err.message);
    } else {
      console.error("Unexpected error:", err);
    }
  }
});
