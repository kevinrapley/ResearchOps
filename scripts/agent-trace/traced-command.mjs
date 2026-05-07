/**
 * @file traced-command.mjs
 * @module TracedCommand
 * @summary Runs commands through a trace-emitting execution boundary.
 */

import { spawn } from "node:child_process";
import { hashValue } from "./trace-redactor.mjs";

function trimOutput(value, limit = 12000) {
  if (!value) {
    return "";
  }

  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n[TRACE_OUTPUT_TRUNCATED length=${value.length}]`;
}

/**
 * Run a command and record start and completion events.
 * @param {object} trace Trace writer.
 * @param {string} command Command to run.
 * @param {string[]} [args] Command arguments.
 * @param {object} [options] Execution options.
 * @returns {Promise<{ exitCode: number | null, stderr: string, stdout: string }>} Command result.
 */
export function runCommand(trace, command, args = [], options = {}) {
  const started = trace.event("command.started", {
    argsHash: hashValue(args),
    argsPreview: options.safeArgsPreview || [],
    command,
    cwd: options.cwd || process.cwd(),
    purpose: options.purpose || "Unspecified command"
  });

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell || false
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      stderr += error.message;
    });

    child.on("close", (exitCode) => {
      trace.event(
        "command.completed",
        {
          command,
          exitCode,
          purpose: options.purpose || "Unspecified command",
          stderr: trimOutput(stderr),
          stdout: trimOutput(stdout)
        },
        {
          parentEventId: started.eventId,
          severity: exitCode === 0 ? "info" : "error"
        }
      );

      resolve({
        exitCode,
        stderr,
        stdout
      });
    });
  });
}
