#!/usr/bin/env node
/**
 * Validates provisioning/status.yaml and reports which build-plan gates are still blocked.
 *
 * Exit codes:
 *   0  file is well formed
 *   1  file is malformed, or --gate <name> was given and that gate is still blocked
 *
 * Usage:
 *   node scripts/check-provisioning.mjs
 *   node scripts/check-provisioning.mjs --gate extension_launch
 *
 * The release workflows call the second form so a store submission cannot proceed while a
 * blocking item is unresolved. Parsing is deliberately hand rolled: this repo has no YAML
 * dependency and the file is a fixed, shallow shape.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const VALID_STATUS = new Set([
  "pending",
  "in_progress",
  "done",
  "blocked",
  "not_applicable",
]);

const here = dirname(fileURLToPath(import.meta.url));
const statusPath = join(here, "..", "provisioning", "status.yaml");

/**
 * Returns a flat list of `{ section, item, status, owner, blocking[] }`.
 *
 * Recognises the two nesting levels the file uses (section, then item) and the keys we act
 * on. Anything deeper, such as the `consumers` and `addresses` lists, is skipped rather than
 * modelled, because nothing reads it programmatically.
 */
function parseStatusFile(text) {
  const entries = [];
  let section = null;
  let item = null;
  let inBlockingList = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line || line.trimStart().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const content = line.trim();

    // Continuation of a multi-line `blocking:` list.
    if (inBlockingList) {
      if (content.startsWith("- ")) {
        item?.blocking.push(content.slice(2).trim());
        continue;
      }
      inBlockingList = false;
    }

    if (indent === 0) {
      const key = content.replace(/:.*$/, "");
      // Scalar top-level keys such as schema_version are not sections.
      section = content.endsWith(":") ? key : null;
      item = null;
      continue;
    }

    if (indent === 2 && content.endsWith(":") && section) {
      item = {
        section,
        item: content.slice(0, -1),
        status: null,
        owner: null,
        blocking: [],
      };
      entries.push(item);
      continue;
    }

    if (indent >= 4 && item) {
      const match = /^([a-z_]+):\s*(.*)$/.exec(content);
      if (!match) continue;
      const [, key, value] = match;

      if (key === "status") item.status = value.trim();
      if (key === "owner") item.owner = value.trim();
      if (key === "blocking") {
        const inline = value.trim();
        if (inline.startsWith("[")) {
          item.blocking = inline
            .replace(/^\[|\]$/g, "")
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        } else if (inline === "") {
          inBlockingList = true;
        }
      }
    }
  }

  return entries;
}

function main() {
  const text = readFileSync(statusPath, "utf8");
  const entries = parseStatusFile(text);
  const problems = [];

  if (entries.length === 0) {
    problems.push("no provisioning items parsed; the file shape changed");
  }

  for (const entry of entries) {
    const id = `${entry.section}.${entry.item}`;
    if (!entry.status) {
      problems.push(`${id}: missing status`);
      continue;
    }
    if (!VALID_STATUS.has(entry.status)) {
      problems.push(
        `${id}: status "${entry.status}" is not one of ${[...VALID_STATUS].join(", ")}`,
      );
    }
    if (entry.status !== "not_applicable" && !entry.owner) {
      problems.push(`${id}: missing owner`);
    }
  }

  if (problems.length > 0) {
    console.error("Provisioning file is malformed:\n");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  const done = entries.filter((e) => e.status === "done" || e.status === "not_applicable");
  console.log(
    `Provisioning: ${done.length} of ${entries.length} items resolved.`,
  );

  const gateArgIndex = process.argv.indexOf("--gate");
  if (gateArgIndex === -1) {
    const gates = new Map();
    for (const entry of entries) {
      if (entry.status === "done" || entry.status === "not_applicable") continue;
      for (const gate of entry.blocking) {
        if (!gates.has(gate)) gates.set(gate, []);
        gates.get(gate).push(`${entry.section}.${entry.item}`);
      }
    }

    if (gates.size > 0) {
      console.log("\nBlocked gates:");
      for (const [gate, blockers] of [...gates].sort()) {
        console.log(`  ${gate}`);
        for (const blocker of blockers) console.log(`    waiting on ${blocker}`);
      }
    }
    return;
  }

  const gate = process.argv[gateArgIndex + 1];
  if (!gate) {
    console.error("--gate requires a gate name");
    process.exit(1);
  }

  const blockers = entries.filter(
    (entry) =>
      entry.blocking.includes(gate) &&
      entry.status !== "done" &&
      entry.status !== "not_applicable",
  );

  if (blockers.length > 0) {
    console.error(`\nGate "${gate}" is blocked by ${blockers.length} item(s):`);
    for (const blocker of blockers) {
      console.error(
        `  ${blocker.section}.${blocker.item} (${blocker.status}, owner ${blocker.owner})`,
      );
    }
    console.error("\nResolve these in provisioning/status.yaml before proceeding.");
    process.exit(1);
  }

  console.log(`Gate "${gate}" is clear.`);
}

main();
