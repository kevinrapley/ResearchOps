/**
 * @file assert-trace-coverage.mjs
 * @module AssertTraceCoverage
 * @summary Asserts that at least one promoted trace .json file exists for
 * the given date when agent-significant operating-model changes are present.
 *
 * Usage:
 *   node scripts/agent-trace/assert-trace-coverage.mjs [--date YYYY-MM-DD]
 *
 * If --date is omitted the check uses today (UTC).
 *
 * Agent-significant paths are changes under:
 *   .agent-operating-model/bundles/
 *   .agent-operating-model/selection-rules.json
 *   .agent-operating-model/task-signal-catalog.json
 *   .agent-operating-model/behavioural-evals.json
 *
 * When no agent-significant changes are detected the check exits 0 without
 * requiring traces. When agent-significant changes are detected and no trace
 * .json files exist for the target date the check exits 1.
 *
 * Git diff strategy (first successful result wins):
 *   1. git diff origin/<GITHUB_BASE_REF>...HEAD  (PR context, GitHub Actions)
 *   2. git diff origin/main...HEAD               (local / push-to-main context)
 *   3. git diff HEAD~1 HEAD                      (last-resort fallback)
 *
 * If all git commands fail the check assumes agent-significant changes are
 * present (safe default — fail open rather than silently skip).
 */

import fs from "node:fs";
import { execSync } from "node:child_process";

const AGENT_PATH_RE =
  /^\.agent-operating-model\/(bundles\/|selection-rules\.json|task-signal-catalog\.json|behavioural-evals\.json)/;

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateArg() {
  const idx = process.argv.indexOf("--date");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : todayUTC();
}

/**
 * Derive the trace directory path for a given date.
 * @param {string} date ISO date string (YYYY-MM-DD).
 * @param {string} [base] Base directory for promoted traces.
 * @returns {string}
 */
export function traceDirForDate(date, base = "docs/agent-audit/reasoning") {
  const [year, month, day] = date.split("-");
  return `${base}/${year}/${month}/${day}`;
}

/**
 * Check whether a trace directory exists and contains at least one .json file.
 * @param {string} dir Absolute or relative path to the date directory.
 * @returns {{ ok: boolean, count?: number, reason?: string }}
 */
export function checkTraceDir(dir) {
  if (!fs.existsSync(dir)) {
    return { ok: false, reason: "missing-dir" };
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    return { ok: false, reason: "no-traces" };
  }

  return { ok: true, count: files.length };
}

function changedFiles() {
  const baseRef = process.env.GITHUB_BASE_REF;
  const candidates = [
    baseRef ? `git diff origin/${baseRef}...HEAD --name-only` : null,
    "git diff origin/main...HEAD --name-only",
    "git diff HEAD~1 HEAD --name-only",
  ].filter(Boolean);

  for (const cmd of candidates) {
    try {
      const out = execSync(cmd, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (out) return out.split("\n");
    } catch {
      // try next candidate
    }
  }

  return null;
}

const date = parseDateArg();
const files = changedFiles();

if (files === null) {
  // All git commands failed — assume agent changes present (safe default)
  console.warn("trace:coverage: git diff unavailable — assuming agent-significant changes");
} else {
  const agentChanges = files.filter((f) => AGENT_PATH_RE.test(f));

  if (agentChanges.length === 0) {
    console.log("trace:coverage: no agent-significant changes — trace coverage check skipped");
    process.exit(0);
  }

  console.log(`trace:coverage: ${agentChanges.length} agent-significant file(s) changed`);
}

const dir = traceDirForDate(date);
const result = checkTraceDir(dir);

if (!result.ok) {
  if (result.reason === "missing-dir") {
    console.error(`trace:coverage: no trace directory found: ${dir}`);
  } else {
    console.error(`trace:coverage: no .json trace files in ${dir}`);
  }
  console.error(`trace:coverage: create trace artefacts at ${dir}/ before merging`);
  process.exit(1);
}

console.log(`trace:coverage: ${result.count} trace(s) in ${dir} — coverage confirmed`);
