/**
 * @file trace-redactor.mjs
 * @module AgentTraceRedactor
 * @summary Redacts sensitive material before trace events are persisted.
 */

import crypto from "node:crypto";

const SECRET_PATTERNS = [
  /(Authorization:\s*Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /(\bBearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]+/gi,
  /(token["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]+/gi,
  /(secret["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]+/gi,
  /(password["']?\s*[:=]\s*["']?)[^"',\s]+/gi
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/**
 * Create a stable SHA-256 hash for a value.
 * @param {unknown} value Value to hash.
 * @returns {string} Prefixed SHA-256 hash.
 */
export function hashValue(value) {
  const serialised = typeof value === "string" ? value : JSON.stringify(value);
  const hash = crypto.createHash("sha256").update(serialised || "").digest("hex");

  return `sha256:${hash}`;
}

function redactString(value) {
  let output = value;
  let redacted = false;
  const reasons = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;

    if (pattern.test(output)) {
      pattern.lastIndex = 0;
      output = output.replace(pattern, "$1[REDACTED]");
      redacted = true;
      reasons.push("secret-like value");
    }
  }

  EMAIL_PATTERN.lastIndex = 0;

  if (EMAIL_PATTERN.test(output)) {
    EMAIL_PATTERN.lastIndex = 0;
    output = output.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
    redacted = true;
    reasons.push("email address");
  }

  return {
    reasons,
    redacted,
    value: output
  };
}

function isSafeControlValue(value) {
  return typeof value === "string" && /^\[[a-z0-9-]+\]$/i.test(value);
}

function redactObject(value) {
  let redacted = false;
  const reasons = [];
  const output = {};

  for (const [key, item] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    if (
      !isSafeControlValue(item) &&
      (lowerKey.includes("authorization") ||
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token"))
    ) {
      output[key] = "[REDACTED]";
      redacted = true;
      reasons.push(`sensitive key: ${key}`);
      continue;
    }

    const result = redactAny(item);
    output[key] = result.value;
    redacted = redacted || result.redacted;
    reasons.push(...result.reasons);
  }

  return {
    reasons: [...new Set(reasons)],
    redacted,
    value: output
  };
}

function redactAny(value) {
  if (value === null || value === undefined) {
    return {
      reasons: [],
      redacted: false,
      value
    };
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    let redacted = false;
    const reasons = [];
    const output = value.map((item) => {
      const result = redactAny(item);
      redacted = redacted || result.redacted;
      reasons.push(...result.reasons);
      return result.value;
    });

    return {
      reasons: [...new Set(reasons)],
      redacted,
      value: output
    };
  }

  if (typeof value === "object") {
    return redactObject(value);
  }

  return {
    reasons: [],
    redacted: false,
    value
  };
}

/**
 * Redact sensitive material from an event payload.
 * @param {Record<string, unknown>} payload Trace event payload.
 * @returns {{ payload: Record<string, unknown>, redaction: object }} Redacted payload and redaction metadata.
 */
export function redactPayload(payload) {
  const result = redactAny(payload || {});

  return {
    payload: result.value,
    redaction: {
      containsSensitiveMaterial: result.redacted,
      redacted: result.redacted,
      redactionReasons: result.reasons
    }
  };
}
