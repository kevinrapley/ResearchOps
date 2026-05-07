/**
 * @file trace-validator.mjs
 * @module AgentTraceValidator
 * @summary Validates trace completeness and trace integrity rules.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";

function hashEvent(event) {
  const copy = { ...event };
  delete copy.eventHash;

  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex")}`;
}

function has(events, eventType) {
  return events.some((event) => event.eventType === eventType);
}

function count(events, eventType) {
  return events.filter((event) => event.eventType === eventType).length;
}

/**
 * Read a JSONL trace event file.
 * @param {string} eventPath Raw event path.
 * @returns {Promise<Array<Record<string, unknown>>>} Parsed events.
 */
export async function readEvents(eventPath) {
  const text = await fs.readFile(eventPath, "utf8");

  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * Validate an event stream.
 * @param {Array<Record<string, unknown>>} events Parsed events.
 * @returns {{ failures: string[], valid: boolean, warnings: string[] }} Validation result.
 */
export function validateEvents(events) {
  const failures = [];
  const warnings = [];

  if (!events.length) {
    failures.push("Trace contains no events.");
    return { failures, valid: false, warnings };
  }

  if (count(events, "run.started") !== 1) {
    failures.push("Trace must contain exactly one run.started event.");
  }

  if (count(events, "run.completed") !== 1) {
    failures.push("Trace must contain exactly one run.completed event.");
  }

  if (!has(events, "prompt.received")) {
    failures.push("Trace must contain a prompt.received event.");
  }

  if (has(events, "trigger.detected") && !has(events, "report.rendered")) {
    failures.push("Trace detected [reasoning] but did not record report.rendered.");
  }

  if (!has(events, "bundle.applied")) {
    warnings.push("Trace does not include bundle.applied evidence.");
  }

  if (!has(events, "decision.recorded")) {
    warnings.push("Trace does not include decision.recorded evidence.");
  }

  const writes = events.filter((event) => event.eventType === "file.write.completed");

  if (writes.length && !has(events, "file.write.planned")) {
    failures.push("Trace includes file.write.completed without file.write.planned.");
  }

  if (writes.length && !has(events, "decision.recorded")) {
    failures.push("Trace includes file writes without decision evidence.");
  }

  const failedCommands = events.filter(
    (event) => event.eventType === "command.completed" && event.payload?.exitCode !== 0
  );

  if (failedCommands.length && !has(events, "issue.detected")) {
    warnings.push("A command failed but no issue.detected event was recorded.");
  }

  if (failedCommands.length && !has(events, "pivot.recorded")) {
    warnings.push("A command failed but no pivot.recorded event was recorded.");
  }

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedPrevious = index === 0 ? null : events[index - 1].eventHash;

    if (event.previousEventHash !== expectedPrevious) {
      failures.push(`Event ${event.eventId} has an invalid previousEventHash.`);
    }

    if (event.eventHash !== hashEvent(event)) {
      failures.push(`Event ${event.eventId} has an invalid eventHash.`);
    }
  }

  const serialised = JSON.stringify(events);

  if (/Bearer\s+[A-Za-z0-9._~+/=-]+/.test(serialised)) {
    failures.push("Trace contains an unredacted bearer token pattern.");
  }

  return {
    failures,
    valid: failures.length === 0,
    warnings
  };
}

/**
 * Validate a raw JSONL trace file.
 * @param {string} eventPath Raw event path.
 * @returns {Promise<{ failures: string[], valid: boolean, warnings: string[] }>} Validation result.
 */
export async function validateTrace(eventPath) {
  const events = await readEvents(eventPath);

  return validateEvents(events);
}
