/**
 * @file validate-traces.mjs
 * @module ValidateTraces
 * @summary Validates raw agent trace files when present.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { validateTrace } from "./trace-validator.mjs";

async function findJsonlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findJsonlFiles(fullPath)));
    }

    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }

  return files;
}

const rootDir = process.cwd();
const traceDir = path.join(rootDir, ".agent-traces", "raw");
const files = await findJsonlFiles(traceDir);
let failed = false;

for (const file of files) {
  const result = await validateTrace(file);

  if (!result.valid) {
    failed = true;
    console.error(`Trace invalid: ${file}`);

    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
  }

  for (const warning of result.warnings) {
    console.warn(`Trace warning in ${file}: ${warning}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Validated ${files.length} trace file(s).`);
