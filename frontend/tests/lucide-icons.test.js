// Guard for the lucide-react upgrade (1.29.0 -> 1.74.0).
//
// The app imports its icons by name from "lucide-react". When the dependency
// moves, the app must end up on at least the release that carries the new icon
// set (1.74.0, where `centerline` was renamed to `axis`), and every icon name
// the app imports must still resolve to a real icon.
//
// The test reads the existing source files and the committed lockfile, so it
// runs without any application change. When the package is installed it also
// checks the resolved module itself.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(FRONTEND_ROOT, "src");
const LOCKFILE = join(FRONTEND_ROOT, "package-lock.json");

// Version this change moves the app to. Anything older does not expose the
// icon set the code below expects.
const MIN_LUCIDE_VERSION = "1.74.0";

const LUCIDE_IMPORT_RE = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']lucide-react["']/g;

function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/** Collect the value (non type-only) icon names each source file imports. */
function collectImportedIcons() {
  const icons = new Map();
  for (const file of listSourceFiles(SRC_DIR)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(LUCIDE_IMPORT_RE)) {
      const isTypeOnly = Boolean(match[1]);
      if (isTypeOnly) continue;
      for (const raw of match[2].split(",")) {
        const name = raw.trim().replace(/^type\s+/, "");
        if (!name) continue;
        if (!icons.has(name)) icons.set(name, file);
      }
    }
  }
  return icons;
}

/** Version of lucide-react recorded in the committed lockfile. */
function lockedVersion() {
  const lock = JSON.parse(readFileSync(LOCKFILE, "utf8"));
  const entry = lock.packages?.["node_modules/lucide-react"];
  assert.ok(entry, "expected package-lock.json to contain lucide-react");
  return entry.version;
}

function versionAtLeast(installed, minimum) {
  const a = installed.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }
  return true;
}

test("lucide-react resolves every icon the app imports", () => {
  const locked = lockedVersion();
  assert.ok(
    versionAtLeast(locked, MIN_LUCIDE_VERSION),
    `expected lucide-react >= ${MIN_LUCIDE_VERSION} in package-lock.json, found ${locked}`,
  );

  const imported = collectImportedIcons();
  assert.ok(imported.size > 0, "expected the app to import at least one lucide-react icon");

  // The package is only present when dependencies are installed; skip the
  // module-level check in a bare checkout so the lockfile assertion above is
  // what decides the result there.
  let lucide;
  try {
    lucide = require("lucide-react");
  } catch {
    return;
  }

  const installed = require("lucide-react/package.json").version;
  assert.ok(
    versionAtLeast(installed, MIN_LUCIDE_VERSION),
    `expected installed lucide-react >= ${MIN_LUCIDE_VERSION}, found ${installed}`,
  );

  const missing = [];
  for (const [name, file] of imported) {
    if (typeof lucide[name] !== "object" && typeof lucide[name] !== "function") {
      missing.push(`${name} (imported by ${file.replace(FRONTEND_ROOT, "frontend")})`);
    }
  }

  assert.deepEqual(missing, [], "lucide-react does not export these imported icons");
});
