import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, extname } from "node:path";

test("source modules stay unambiguous on case-insensitive Windows filesystems", () => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const modules = new Map<string, string>();
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(entry.name))) {
        const name = relative(root, path);
        const lookup = name.slice(0, -extname(name).length).toLocaleLowerCase("en-US");
        assert.ok(!modules.has(lookup), `Ambiguous Windows import: ${modules.get(lookup)} / ${name}`);
        modules.set(lookup, name);
      }
    }
  }
  walk(root);
  assert.ok(modules.size > 20);
});
