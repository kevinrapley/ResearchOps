/**
 * @file trace-writer.mjs
 * @module AgentTraceWriter
 * @summary Writes append-only, hash-chained JSONL trace events for agent work.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redactPayload } from "./trace-redactor.mjs";

const DEFAULT_ACTOR = Object.freeze({
  id: "researchops-agent",
  kind: "agent",
  model: "unknown"
});

function nowIso() {
  return new Date().toISOString();
}

function compactTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

function slugify(value) {
  return (
    String(value || "agent-run")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "agent-run"
  );
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function hashEvent(event) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(event)).digest("hex")}`;
}

/**
 * Append-only trace writer for agent audit events.
 */
export class AgentTraceWriter {
  /**
   * Create a trace writer.
   * @param {object} [options] Writer options.
   * @param {object} [options.actor] Actor metadata.
   * @param {Date} [options.date] Date used for trace ID generation.
   * @param {string} [options.rawDir] Raw event output directory.
   * @param {string} [options.rootDir] Repository root directory.
   * @param {string} [options.slug] Human-readable trace slug.
   * @param {string} [options.traceId] Explicit trace ID.
   */
  constructor(options = {}) {
    const date = options.date || new Date();
    const slug = slugify(options.slug);

    this.actor = options.actor || DEFAULT_ACTOR;
    this.rootDir = options.rootDir || process.cwd();
    this.rawDir = options.rawDir || path.join(this.rootDir, ".agent-traces", "raw");
    this.traceId = options.traceId || `atrace-${compactTimestamp(date)}-${slug}`;
    this.eventPath = path.join(this.rawDir, `${this.traceId}.jsonl`);
    this.previousEventHash = null;

    fs.mkdirSync(this.rawDir, { recursive: true });
  }

  /**
   * Record a trace event.
   * @param {string} eventType Event type.
   * @param {Record<string, unknown>} [payload] Event payload.
   * @param {object} [options] Event options.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  event(eventType, payload = {}, options = {}) {
    const redacted = redactPayload(payload);
    const event = {
      actor: options.actor || this.actor,
      eventId: options.eventId || randomId("evt"),
      eventType,
      hashes: options.hashes || {},
      parentEventId: options.parentEventId,
      payload: redacted.payload,
      previousEventHash: this.previousEventHash,
      redaction: redacted.redaction,
      schemaVersion: "1.0.0",
      severity: options.severity || "info",
      timestamp: nowIso(),
      traceId: this.traceId,
      traceLayer: options.traceLayer || "operational"
    };

    event.eventHash = hashEvent(event);
    fs.appendFileSync(this.eventPath, `${JSON.stringify(event)}\n`, "utf8");
    this.previousEventHash = event.eventHash;

    return event;
  }

  /**
   * Record run start.
   * @param {Record<string, unknown>} [payload] Run metadata.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  startRun(payload = {}) {
    return this.event("run.started", payload);
  }

  /**
   * Record run completion.
   * @param {Record<string, unknown>} [payload] Completion metadata.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  completeRun(payload = {}) {
    return this.event("run.completed", payload);
  }

  /**
   * Record an auditable decision.
   * @param {Record<string, unknown>} payload Decision payload.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  recordDecision(payload) {
    return this.event("decision.recorded", payload);
  }

  /**
   * Record an assumption.
   * @param {Record<string, unknown>} payload Assumption payload.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  recordAssumption(payload) {
    return this.event("assumption.recorded", payload);
  }

  /**
   * Record an implementation issue.
   * @param {Record<string, unknown>} payload Issue payload.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  recordIssue(payload) {
    return this.event("issue.detected", payload, { severity: payload.severity || "warning" });
  }

  /**
   * Record a pivot after an issue or constraint.
   * @param {Record<string, unknown>} payload Pivot payload.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  recordPivot(payload) {
    return this.event("pivot.recorded", payload, { severity: "notice" });
  }

  /**
   * Record a residual risk.
   * @param {Record<string, unknown>} payload Risk payload.
   * @returns {Record<string, unknown>} Event written to disk.
   */
  recordRisk(payload) {
    return this.event("risk.recorded", payload, { severity: payload.severity || "warning" });
  }
}
