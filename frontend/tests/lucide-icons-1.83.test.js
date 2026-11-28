// Guard for the lucide-react upgrade (1.81.0 -> 1.83.0).
//
// The app imports its icons by name from "lucide-react". Moving to 1.83.0 adds
// `mail-send`, the chevrons offset icons, `boxing-glove`, `balcony` and the
// square text-align-bottom icons, and removes the lab-only `burger`,
// `card-credit`, `football` and `pac-man-ghost` exports. The lockfile must pin
// the new release, no source file may import a removed icon, and (when the
// package is installed) every icon the app imports must still resolve.

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
// icon set below.
const MIN_LUCIDE_VERSION = "1.83.0";

// Icons introduced in the 1.83.0 release this guard tracks.
const ADDED_ICONS = [
  "MailSend",
  "ChevronsDownUpOffset",
  "ChevronsRightLeftOffset",
  "BoxingGlove",
  "Balcony",
  "SquareTextAlignBottomCenter",
  "SquareTextAlignBottomLeft",
  "SquareTextAlignBottomRight",
];

// Lab icons removed in 1.83.0; importing one of these would break the build.
const REMOVED_ICONS = ["Burger", "CardCredit", "Football", "PacManGhost"];

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

test("lucide-react is pinned to the 1.83.0 icon set", () => {
  const locked = lockedVersion();
  assert.ok(
    versionAtLeast(locked, MIN_LUCIDE_VERSION),
    `expected lucide-react >= ${MIN_LUCIDE_VERSION} in package-lock.json, found ${locked}`,
  );

  const imported = collectImportedIcons();
  assert.ok(imported.size > 0, "expected the app to import at least one lucide-react icon");

  const removedImports = REMOVED_ICONS.filter((name) => imported.has(name));
  assert.deepEqual(
    removedImports,
    [],
    "the app imports lucide-react icons removed in 1.83.0",
  );

  // The package is only present when dependencies are installed; skip the
  // module-level check in a bare checkout so the lockfile assertion decides.
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

  const hasIcon = (name) =>
    typeof lucide[name] === "object" || typeof lucide[name] === "function";

  assert.deepEqual(
    ADDED_ICONS.filter((name) => !hasIcon(name)),
    [],
    "lucide-react does not export the 1.83.0 icons",
  );

  assert.deepEqual(
    REMOVED_ICONS.filter((name) => hasIcon(name)),
    [],
    "lucide-react still exports lab icons removed in 1.83.0",
  );

  const missing = [];
  for (const [name, file] of imported) {
    if (!hasIcon(name)) {
      missing.push(`${name} (imported by ${file.replace(FRONTEND_ROOT, "frontend")})`);
    }
  }

  assert.deepEqual(missing, [], "lucide-react does not export these imported icons");
});
