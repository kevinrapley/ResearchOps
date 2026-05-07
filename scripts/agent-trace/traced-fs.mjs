/**
 * @file traced-fs.mjs
 * @module TracedFilesystem
 * @summary Provides trace-emitting filesystem boundaries for agent work.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function hashContent(content) {
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function resolveInsideRoot(rootDir, filePath) {
  if (path.isAbsolute(filePath)) {
    throw new Error(`Traced filesystem path must be relative: ${filePath}`);
  }

  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, filePath);
  const relative = path.relative(resolvedRoot, resolvedPath);

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Traced filesystem path escapes root: ${filePath}`);
  }

  return {
    absolutePath: resolvedPath,
    relative
  };
}

/**
 * Filesystem wrapper that records file reads and writes.
 */
export class TracedFilesystem {
  /**
   * Create a traced filesystem wrapper.
   * @param {object} trace Trace writer.
   * @param {object} [options] Wrapper options.
   * @param {string} [options.rootDir] Repository root directory.
   */
  constructor(trace, options = {}) {
    this.rootDir = path.resolve(options.rootDir || process.cwd());
    this.trace = trace;
  }

  /**
   * Read a text file and record the access.
   * @param {string} filePath Repository-relative file path.
   * @param {string} purpose Reason the file is needed.
   * @returns {Promise<string>} File contents.
   */
  async readTextFile(filePath, purpose) {
    const { absolutePath, relative } = resolveInsideRoot(this.rootDir, filePath);
    const content = await fs.readFile(absolutePath, "utf8");

    this.trace.event("file.read", {
      bytes: Buffer.byteLength(content, "utf8"),
      contentHash: hashContent(content),
      path: relative,
      purpose
    });

    return content;
  }

  /**
   * Write a text file and record the planned and completed operation.
   * @param {string} filePath Repository-relative file path.
   * @param {string} content File contents.
   * @param {string} purpose Reason the file is written.
   * @returns {Promise<{ contentHash: string, path: string }>} Write metadata.
   */
  async writeTextFile(filePath, content, purpose) {
    const { absolutePath, relative } = resolveInsideRoot(this.rootDir, filePath);
    const contentHash = hashContent(content);

    this.trace.event("file.write.planned", {
      bytes: Buffer.byteLength(content, "utf8"),
      contentHash,
      path: relative,
      purpose
    });

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");

    this.trace.event("file.write.completed", {
      bytes: Buffer.byteLength(content, "utf8"),
      contentHash,
      path: relative,
      purpose
    });

    return {
      contentHash,
      path: relative
    };
  }
}
