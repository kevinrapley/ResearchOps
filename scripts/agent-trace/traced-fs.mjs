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

function missing(error) {
  return error?.code === "ENOENT";
}

function inside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function lexicalPath(rootDir, filePath) {
  if (path.isAbsolute(filePath)) {
    throw new Error(`Traced filesystem path must be relative: ${filePath}`);
  }

  const rootPath = path.resolve(rootDir);
  const targetPath = path.resolve(rootPath, filePath);
  const relative = path.relative(rootPath, targetPath);

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Traced filesystem path escapes root: ${filePath}`);
  }

  return { relative, rootPath, targetPath };
}

async function optionalRealpath(filePath) {
  try {
    return await fs.realpath(filePath);
  } catch (error) {
    if (missing(error)) {
      return null;
    }

    throw error;
  }
}

async function nearestExisting(rootDir, targetPath) {
  const rootPath = path.resolve(rootDir);
  let currentPath = targetPath;

  while (currentPath !== rootPath) {
    try {
      await fs.lstat(currentPath);
      return currentPath;
    } catch (error) {
      if (!missing(error)) {
        throw error;
      }

      currentPath = path.dirname(currentPath);
    }
  }

  return rootPath;
}

async function realRootAndTarget(rootDir, targetPath, filePath) {
  const realRoot = await fs.realpath(rootDir);
  const realTarget = await fs.realpath(targetPath);

  if (!inside(realRoot, realTarget)) {
    throw new Error(`Traced filesystem path escapes root: ${filePath}`);
  }

  return { realRoot, realTarget };
}

async function readablePath(rootDir, filePath) {
  const lexical = lexicalPath(rootDir, filePath);
  const { realTarget } = await realRootAndTarget(rootDir, lexical.targetPath, filePath);

  return {
    absolutePath: realTarget,
    relative: lexical.relative
  };
}

async function writablePath(rootDir, filePath) {
  const lexical = lexicalPath(rootDir, filePath);
  const parentPath = path.dirname(lexical.targetPath);
  const nearestPath = await nearestExisting(rootDir, parentPath);
  const { realRoot } = await realRootAndTarget(rootDir, nearestPath, filePath);
  const existingTarget = await optionalRealpath(lexical.targetPath);

  if (existingTarget && !inside(realRoot, existingTarget)) {
    throw new Error(`Traced filesystem path escapes root: ${filePath}`);
  }

  await fs.mkdir(parentPath, { recursive: true });

  const realParent = await fs.realpath(parentPath);

  if (!inside(realRoot, realParent)) {
    throw new Error(`Traced filesystem path escapes root: ${filePath}`);
  }

  return {
    absolutePath: existingTarget || path.join(realParent, path.basename(lexical.targetPath)),
    relative: lexical.relative
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
    const { absolutePath, relative } = await readablePath(this.rootDir, filePath);
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
    const { absolutePath, relative } = await writablePath(this.rootDir, filePath);
    const contentHash = hashContent(content);

    this.trace.event("file.write.planned", {
      bytes: Buffer.byteLength(content, "utf8"),
      contentHash,
      path: relative,
      purpose
    });

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
