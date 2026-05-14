/**
 * @file assert-trace-coverage.mjs
 * @module AssertTraceCoverage
 * @summary Enforces ResearchOps branch-prefix governance and trace coverage.
 *
 * Usage:
 *   node scripts/agent-trace/assert-trace-coverage.mjs [--date YYYY-MM-DD]
 *
 * If --date is omitted the check uses today (UTC).
 *
 * Work branches must use one of these prefixes:
 *   feature/
 *   chore/
 *   test/
 *   fix/
 *   perf/
 *   hotfix/
 *
 * Trace coverage is required for:
 *   feature/
 *   chore/
 *   test/
 *   fix/
 *   perf/
 *
 * Trace coverage is not required for:
 *   hotfix/
 *
 * Mainline branch names are exempt from work-branch prefix checks:
 *   main
 *   master
 *
 * The legacy [reasoning] token is not required for trace coverage. Branch
 * posture determines whether an auditable trace is required.
 */

import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ALLOWED_WORK_BRANCH_PREFIXES = Object.freeze([
  "feature/",
  "chore/",
  "test/",
  "fix/",
  "perf/",
  "hotfix/",
]);

export const TRACE_REQUIRED_BRANCH_PREFIXES = Object.freeze([
  "feature/",
  "chore/",
  "test/",
  "fix/",
  "perf/",
]);

const MAINLINE_BRANCHES = new Set(["main", "master"]);
const AGENT_PATH_RE =
  /^\.agent-operating-model\/(bundles\/|selection-rules\.json|task-signal-catalog\.json|behavioural-evals\.json|trace-policy\.md|README\.md)/;

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateArg() {
  const idx = process.argv.indexOf("--date");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : todayUTC();
}

function stripPrefix(value, prefix) {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/**
 * Normalise branch references from GitHub Actions and local Git output.
 * @param {string | undefined | null} input Raw branch reference.
 * @returns {string}
 */
export function normaliseBranchName(input) {
  if (!input) return "";

  let branch = String(input).trim();
  branch = stripPrefix(branch, "refs/heads/");
  branch = stripPrefix(branch, "origin/");

  return branch;
}

/**
 * Return the branch name from the current environment.
 * @returns {string}
 */
export function currentBranchName() {
  const envBranch =
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    process.env.BRANCH_NAME ||
    process.env.CI_COMMIT_REF_NAME;

  if (envBranch) return normaliseBranchName(envBranch);

  try {
    return normaliseBranchName(
      execSync("git branch --show-current", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim(),
    );
  } catch {
    return "";
  }
}

/**
 * Derive trace policy from the current branch name.
 * @param {string} branchName Branch name or ref.
 * @returns {{ branch: string, allowed: boolean, requiresTrace: boolean, reason: string, prefix?: string, allowedPrefixes?: string[] }}
 */
export function branchTracePolicy(branchName) {
  const branch = normaliseBranchName(branchName);

  if (!branch) {
    return {
      branch,
      allowed: true,
      requiresTrace: false,
      reason: "unknown-branch",
    };
  }

  if (MAINLINE_BRANCHES.has(branch)) {
    return {
      branch,
      allowed: true,
      requiresTrace: false,
      reason: "mainline-branch",
    };
  }

  const prefix = ALLOWED_WORK_BRANCH_PREFIXES.find((candidate) =>
    branch.startsWith(candidate),
  );

  if (!prefix) {
    return {
      branch,
      allowed: false,
      requiresTrace: false,
      reason: "invalid-prefix",
      allowedPrefixes: [...ALLOWED_WORK_BRANCH_PREFIXES],
    };
  }

  const requiresTrace = TRACE_REQUIRED_BRANCH_PREFIXES.includes(prefix);

  return {
    branch,
    allowed: true,
    prefix,
    requiresTrace,
    reason: requiresTrace ? "trace-required-prefix" : "hotfix-no-trace",
  };
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

  console.warn("trace:coverage: git diff unavailable — falling back to branch policy only");
  return [];
}

function assertTraceExists(date) {
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
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const date = parseDateArg();
  const branch = currentBranchName();
  const policy = branchTracePolicy(branch);

  if (!policy.allowed) {
    console.error(`trace:coverage: invalid branch prefix for ${policy.branch}`);
    console.error(`trace:coverage: allowed prefixes: ${policy.allowedPrefixes.join(", ")}`);
    process.exit(1);
  }

  if (policy.requiresTrace) {
    console.log(
      `trace:coverage: branch ${policy.branch} uses ${policy.prefix} and requires an audit trace`,
    );
    assertTraceExists(date);
    process.exit(0);
  }

  if (policy.reason === "hotfix-no-trace") {
    console.log(`trace:coverage: branch ${policy.branch} is hotfix/ — trace coverage skipped`);
    process.exit(0);
  }

  const files = changedFiles();
  const agentChanges = files.filter((f) => AGENT_PATH_RE.test(f));

  if (agentChanges.length === 0) {
    console.log("trace:coverage: no trace-required branch or agent-significant changes — trace coverage check skipped");
    process.exit(0);
  }

  console.log(`trace:coverage: ${agentChanges.length} agent-significant file(s) changed`);
  assertTraceExists(date);
}
