/**
 * @file trace-renderer.mjs
 * @module AgentTraceRenderer
 * @summary Renders raw agent trace events into a user-readable audit report.
 */

import fs from "node:fs/promises";
import path from "node:path";

function byType(events, eventType) {
  return events.filter((event) => event.eventType === eventType);
}

function safe(value) {
  if (value === undefined || value === null || value === "") {
    return "Not recorded";
  }

  return String(value);
}

function list(items, fallback = "None recorded.") {
  if (!items.length) {
    return fallback;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * Read a JSONL trace event file.
 * @param {string} eventPath Raw event path.
 * @returns {Promise<Array<Record<string, unknown>>>} Parsed events.
 */
export async function readTraceEvents(eventPath) {
  const text = await fs.readFile(eventPath, "utf8");

  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * Build a compact machine-readable summary from events.
 * @param {Array<Record<string, unknown>>} events Trace events.
 * @returns {Record<string, unknown>} Summary object.
 */
export function buildTraceSummary(events) {
  const first = events[0] || {};
  const last = events.at(-1) || {};

  return {
    completedAt: last.timestamp,
    eventCount: events.length,
    redactedEventCount: events.filter((event) => event.redaction?.redacted).length,
    startedAt: first.timestamp,
    traceId: first.traceId,
    types: [...new Set(events.map((event) => event.eventType))]
  };
}

/**
 * Render trace events as Markdown.
 * @param {Array<Record<string, unknown>>} events Trace events.
 * @returns {string} Markdown report.
 */
export function renderMarkdown(events) {
  const first = events[0] || {};
  const last = events.at(-1) || {};
  const run = byType(events, "run.started")[0];
  const prompt = byType(events, "prompt.received")[0];
  const trigger = byType(events, "trigger.detected")[0];
  const bundles = byType(events, "bundle.applied");
  const conflicts = byType(events, "bundle.conflict");
  const precedence = byType(events, "bundle.precedence_decided");
  const reads = byType(events, "file.read");
  const writes = byType(events, "file.write.completed");
  const commands = byType(events, "command.completed");
  const decisions = byType(events, "decision.recorded");
  const assumptions = byType(events, "assumption.recorded");
  const issues = byType(events, "issue.detected");
  const pivots = byType(events, "pivot.recorded");
  const risks = byType(events, "risk.recorded");
  const title = run?.payload?.title || "Agent audit trace";
  const lines = [];

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(
    "> This is an auditable agent trace generated from structured events. It records task interpretation, bundle orchestration, context use, actions, decisions, issues, pivots and residual risks. It does not expose private chain-of-thought."
  );
  lines.push("");
  lines.push("## Run metadata");
  lines.push("");
  lines.push(`- Trace ID: \`${safe(first.traceId)}\``);
  lines.push(`- Started: ${safe(first.timestamp)}`);
  lines.push(`- Completed: ${safe(last.timestamp)}`);
  lines.push(`- Repository: ${safe(run?.payload?.repository)}`);
  lines.push(`- Branch: ${safe(run?.payload?.branch)}`);
  lines.push(`- Agent: ${safe(first.actor?.id)}`);
  lines.push(`- Model: ${safe(first.actor?.model)}`);
  lines.push("");
  lines.push("## Trigger and task interpretation");
  lines.push("");
  lines.push(`- Reasoning trigger detected: ${trigger ? "Yes" : "No"}`);
  lines.push(`- Trigger token: ${safe(trigger?.payload?.token)}`);
  lines.push(`- Prompt hash: ${safe(prompt?.payload?.promptHash)}`);
  lines.push("");
  lines.push("### Safe prompt excerpt");
  lines.push("");
  lines.push("```text");
  lines.push(safe(prompt?.payload?.safeExcerpt));
  lines.push("```");
  lines.push("");
  lines.push("### Interpreted task");
  lines.push("");
  lines.push(safe(run?.payload?.interpretedTask));
  lines.push("");
  lines.push("## Bundle orchestration");
  lines.push("");
  lines.push(
    list(
      bundles.map((event) => {
        const payload = event.payload || {};
        return `\`${safe(payload.bundleId)}\` — ${safe(payload.name)}. Rules applied: ${
          payload.appliedRules?.length || 0
        }.`;
      })
    )
  );
  lines.push("");
  lines.push("### Bundle conflicts");
  lines.push("");
  lines.push(
    list(
      conflicts.map((event) => {
        const payload = event.payload || {};
        return `${safe(payload.conflict)} Impact: ${safe(payload.affectedDecision)}.`;
      })
    )
  );
  lines.push("");
  lines.push("### Precedence decisions");
  lines.push("");
  lines.push(
    list(
      precedence.map((event) => {
        const payload = event.payload || {};
        return `Winning bundle: \`${safe(payload.winningBundle)}\`. Rationale: ${safe(payload.rationale)}.`;
      })
    )
  );
  lines.push("");
  lines.push("## Context consulted");
  lines.push("");
  lines.push(
    list(
      reads.map((event) => {
        const payload = event.payload || {};
        return `\`${safe(payload.path)}\` — ${safe(payload.purpose)}.`;
      })
    )
  );
  lines.push("");
  lines.push("## Decisions and assumptions");
  lines.push("");
  lines.push("### Decisions");
  lines.push("");
  lines.push(
    list(
      decisions.map((event) => {
        const payload = event.payload || {};
        return `${safe(payload.decision)} Rationale: ${safe(payload.rationale)}.`;
      })
    )
  );
  lines.push("");
  lines.push("### Assumptions");
  lines.push("");
  lines.push(
    list(
      assumptions.map((event) => {
        const payload = event.payload || {};
        return `${safe(payload.assumption)} Basis: ${safe(payload.basis)}.`;
      })
    )
  );
  lines.push("");
  lines.push("## Actions taken");
  lines.push("");
  lines.push("### Files written");
  lines.push("");
  lines.push(
    list(
      writes.map((event) => {
        const payload = event.payload || {};
        return `\`${safe(payload.path)}\` — ${safe(payload.purpose)}.`;
      })
    )
  );
  lines.push("");
  lines.push("### Commands completed");
  lines.push("");
  lines.push(
    list(
      commands.map((event) => {
        const payload = event.payload || {};
        return `\`${safe(payload.command)}\` exited with ${safe(payload.exitCode)} — ${safe(payload.purpose)}.`;
      })
    )
  );
  lines.push("");
  lines.push("## Issues and pivots");
  lines.push("");
  lines.push(
    list([
      ...issues.map((event) => {
        const payload = event.payload || {};
        return `Issue: ${safe(payload.issue)} Cause: ${safe(payload.cause)}.`;
      }),
      ...pivots.map((event) => {
        const payload = event.payload || {};
        return `Pivot: ${safe(payload.pivot)} Outcome: ${safe(payload.outcome)}.`;
      })
    ])
  );
  lines.push("");
  lines.push("## Residual risks");
  lines.push("");
  lines.push(
    list(
      risks.map((event) => {
        const payload = event.payload || {};
        return `${safe(payload.risk)} Mitigation: ${safe(payload.mitigation)}.`;
      })
    )
  );
  lines.push("");
  lines.push("## Trace integrity");
  lines.push("");
  lines.push(`- Raw events recorded: ${events.length}`);
  lines.push(`- Redacted events: ${events.filter((event) => event.redaction?.redacted).length}`);
  lines.push(`- Hash chained: ${events.every((event) => event.eventHash) ? "Yes" : "No"}`);
  lines.push(`- Run completed event present: ${byType(events, "run.completed").length === 1 ? "Yes" : "No"}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Render raw trace events to Markdown and JSON summary files.
 * @param {string} eventPath Raw JSONL event path.
 * @param {string} markdownPath Markdown report path.
 * @param {string} [summaryPath] Optional JSON summary path.
 * @returns {Promise<{ eventCount: number, markdownPath: string, summaryPath?: string }>} Render metadata.
 */
export async function renderTrace(eventPath, markdownPath, summaryPath) {
  const events = await readTraceEvents(eventPath);
  const markdown = renderMarkdown(events);

  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.writeFile(markdownPath, markdown, "utf8");

  if (summaryPath) {
    await fs.mkdir(path.dirname(summaryPath), { recursive: true });
    await fs.writeFile(summaryPath, `${JSON.stringify(buildTraceSummary(events), null, 2)}\n`, "utf8");
  }

  return {
    eventCount: events.length,
    markdownPath,
    summaryPath
  };
}
