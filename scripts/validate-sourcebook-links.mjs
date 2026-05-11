/**
 * @file validate-sourcebook-links.mjs
 * @module ValidateSourcebookLinks
 * @summary Validates all internal links in the Research Operations Sourcebook.
 *
 * Checks:
 *   - In-page anchors: target id exists in the same file
 *   - Cross-page links: target .html file exists in the sourcebook directory
 *   - Asset links (styles.css, etc.): file exists
 *   - Template links (templates/*): file exists
 *
 * External links (http/https/mailto) are counted but not validated —
 * Lychee handles those in the qa-links workflow.
 *
 * href="#" is treated as a placeholder and skipped.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCEBOOK_DIR = path.join(ROOT_DIR, "docs/devops/sourcebook");

const HREF_RE = /href=["']([^"']+)["']/g;
const ID_RE = /\bid=["']([^"']+)["']/g;

function extractHrefs(html) {
  const hrefs = [];
  let match;
  HREF_RE.lastIndex = 0;
  while ((match = HREF_RE.exec(html)) !== null) {
    hrefs.push(match[1]);
  }
  return hrefs;
}

function extractIds(html) {
  const ids = new Set();
  let match;
  ID_RE.lastIndex = 0;
  while ((match = ID_RE.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function categorize(href) {
  if (href === "#") return "placeholder";
  if (/^(https?:|mailto:)/.test(href)) return "external";
  if (href.startsWith("#")) return "anchor";
  const [filePart] = href.split("#");
  if (href.includes("#")) return filePart.endsWith(".html") ? "cross-page-anchor" : "asset-anchor";
  return "local";
}

export function validateSourcebookLinks({ sourcebookDir = SOURCEBOOK_DIR } = {}) {
  if (!fs.existsSync(sourcebookDir)) {
    throw new Error(`sourcebook: directory not found: ${sourcebookDir}`);
  }

  const htmlFiles = fs
    .readdirSync(sourcebookDir)
    .filter((f) => f.endsWith(".html"))
    .sort();

  const fileContents = new Map();
  const fileIds = new Map();

  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(sourcebookDir, file), "utf8");
    fileContents.set(file, content);
    fileIds.set(file, extractIds(content));
  }

  const broken = [];
  let totalLinks = 0;
  let externalCount = 0;
  let skippedCount = 0;

  for (const file of htmlFiles) {
    const content = fileContents.get(file);
    const hrefs = extractHrefs(content);

    for (const href of hrefs) {
      const type = categorize(href);

      if (type === "placeholder") {
        skippedCount++;
        continue;
      }

      totalLinks++;

      if (type === "external") {
        externalCount++;
        continue;
      }

      if (type === "anchor") {
        const anchorId = href.slice(1);
        if (!fileIds.get(file).has(anchorId)) {
          broken.push({ file, href, reason: `anchor #${anchorId} not found in ${file}` });
        }
        continue;
      }

      const [filePart, anchorPart] = href.split("#");
      const targetPath = path.join(sourcebookDir, filePart);

      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
        broken.push({ file, href, reason: `file not found: ${filePart}` });
        continue;
      }

      if (anchorPart) {
        let targetIds = fileIds.get(filePart);
        if (!targetIds) {
          targetIds = extractIds(fs.readFileSync(targetPath, "utf8"));
        }
        if (!targetIds.has(anchorPart)) {
          broken.push({ file, href, reason: `anchor #${anchorPart} not found in ${filePart}` });
        }
      }
    }
  }

  if (broken.length > 0) {
    for (const { file, href, reason } of broken) {
      console.error(`sourcebook: broken link in ${file}: ${href} — ${reason}`);
    }
    throw new Error(`sourcebook: ${broken.length} broken link(s) found`);
  }

  return { pages: htmlFiles.length, totalLinks, externalCount, skippedCount };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateSourcebookLinks();
  console.log(
    `sourcebook: validated ${result.pages} pages, ${result.totalLinks} links` +
      ` (${result.externalCount} external skipped)`,
  );
}
