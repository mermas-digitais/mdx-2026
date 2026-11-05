import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("MDX public discovery uses its own domain, not FabITZ", () => {
  for (const file of ["src/lib/event-metadata.ts", "src/app/sitemap.ts", "src/app/robots.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /mdx26\.mermasdigitais\.com\.br/);
    assert.doesNotMatch(source, /mdx26\.fabitz\.com\.br/);
  }
});
