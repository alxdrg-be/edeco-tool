import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Enumerate explicitly so Windows and Unix run the same files without shell globbing.
function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return discover(path);
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const tests = discover(fileURLToPath(new URL("../src/", import.meta.url))).sort();
if (tests.length === 0) throw new Error("Keine UI-Testdateien gefunden.");
const child = spawnSync(process.execPath,
  ["--experimental-strip-types", "--test", ...process.argv.slice(2), ...tests],
  { stdio: "inherit" });
if (child.error) throw child.error;
process.exit(child.status ?? 1);
