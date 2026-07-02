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
 *   - Sourcebook quality gates: no placeholders, R/P/G/C labels, change history,
 *     dc:modified metadata, and no orphaned template definitions or files
 *
 * External links (http/https/mailto) are counted but not validated —
 * Lychee handles those in the qa-links workflow.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCEBOOK_DIR = path.join(ROOT_DIR, "docs/devops/sourcebook");
const GOVUK_SOURCEBOOK_DIR = path.join(ROOT_DIR, "public/pages/sourcebook");
const SOURCEBOOK_INDEX_PATH = path.join(ROOT_DIR, "sourcebook/sourcebook-index.json");

const HREF_RE = /href=["']([^"']+)["']/g;
const ID_RE = /\bid=["']([^"']+)["']/g;
const REQUIRED_CONTENT_TYPES = {
  rule: { label: "Rule", notation: "R" },
  principle: { label: "Principle", notation: "P" },
  guidance: { label: "Guidance", notation: "G" },
  conduct: { label: "Conduct", notation: "C" },
};
const PLACEHOLDER_PATTERNS = [
  { label: "href placeholder", pattern: /href=["']#["']/i },
  { label: "placeholder token", pattern: /\[(?:YYYY-MM-DD|Date|Pillar Title|PILLAR|Section Title|First Topic Title|Second Topic Title|Sub-Topic Area Title|Principle Title|Rule Title|Guidance Title|Principle text|Rule text|Guidance text|Term|Definition|Opening definition|Short summary|Extended description)[^\]]*\]/i },
  { label: "placeholder word", pattern: /\b(?:TODO|TBD|FIXME|PLACEHOLDER|Lorem ipsum|Coming soon|To be confirmed|To be decided|Needs content)\b/i },
  { label: "insert-here placeholder", pattern: /\bInsert .+ here\b/i },
];

function posixRelative(from, to) {
  return path.relative(from, to).split(path.sep).join("/");
}

function listHtmlFiles(dir, { recursive = false } = {}) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) walk(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".html")) {
        files.push(posixRelative(dir, entryPath));
      }
    }
  };

  walk(dir);
  return files.sort();
}

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

function hasDcModified(content) {
  return /\bproperty=["']dc:modified["'][^>]+\bcontent=["'][^"']+["']/i.test(content);
}

function hasChangeHistory(content) {
  return /Change\s+history|Change\s+History|change-history/i.test(content);
}

function findPlaceholder(content) {
  for (const { label, pattern } of PLACEHOLDER_PATTERNS) {
    const match = content.match(pattern);
    if (match) return { label, value: match[0] };
  }
  return null;
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ");
}

function hasAccessibleBadgeLabel(content, badgeMatch, label) {
  if (new RegExp(`aria-label=["']${label}["']`, "i").test(badgeMatch[0])) {
    return true;
  }

  const nearby = stripTags(content.slice(badgeMatch.index, badgeMatch.index + 360));
  return new RegExp(`\\b${label}\\b`, "i").test(nearby);
}

function validateContentTypeBadges(content, label, file, problems) {
  const badgeRe =
    /<span\b(?=[^>]*\b(?:sourcebook-clause-badge|rule-badge)\b)[^>]*>(?:\s*)([RPGC])(?:\s*)<\/span>/gi;
  let match;
  while ((match = badgeRe.exec(content)) !== null) {
    const expected = Object.values(REQUIRED_CONTENT_TYPES).find(
      (type) => type.notation === match[1],
    );
    if (!expected) continue;
    if (!hasAccessibleBadgeLabel(content, match, expected.label)) {
      problems.push({
        file: `${label}/${file}`,
        reason: `${expected.notation} badge is missing the ${expected.label} label`,
      });
    }
  }
}

function validateHtmlQuality({ dir, label, recursive, requireChangeHistory }, problems) {
  for (const file of listHtmlFiles(dir, { recursive })) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const placeholder = findPlaceholder(content);

    if (placeholder) {
      problems.push({
        file: `${label}/${file}`,
        reason: `${placeholder.label}: ${placeholder.value}`,
      });
    }

    if (!hasDcModified(content)) {
      problems.push({ file: `${label}/${file}`, reason: "missing dc:modified metadata" });
    }

    if (requireChangeHistory(file) && !hasChangeHistory(content)) {
      problems.push({ file: `${label}/${file}`, reason: "missing change history" });
    }

    validateContentTypeBadges(content, label, file, problems);
  }
}

function walkStrings(value, visit, trail = []) {
  if (typeof value === "string") {
    visit(value, trail);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, [...trail, index]));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, visit, [...trail, key]);
    }
  }
}

function collectRelatedTemplates(value, visit, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRelatedTemplates(item, visit, [...trail, index]));
    return;
  }

  if (!value || typeof value !== "object") return;

  if (Array.isArray(value.relatedTemplates)) {
    for (const templateId of value.relatedTemplates) {
      visit(templateId, trail);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    collectRelatedTemplates(child, visit, [...trail, key]);
  }
}

function validateSourcebookModel({ sourcebookIndexPath, sourcebookDir }, problems) {
  if (!fs.existsSync(sourcebookIndexPath)) {
    problems.push({ file: sourcebookIndexPath, reason: "sourcebook-index.json not found" });
    return;
  }

  const sourcebook = JSON.parse(fs.readFileSync(sourcebookIndexPath, "utf8"));

  walkStrings(sourcebook, (value, trail) => {
    const placeholder = findPlaceholder(value);
    if (placeholder) {
      problems.push({
        file: `sourcebook-index.json#/${trail.join("/")}`,
        reason: `${placeholder.label}: ${placeholder.value}`,
      });
    }
  });

  for (const [key, expected] of Object.entries(REQUIRED_CONTENT_TYPES)) {
    const actual = sourcebook.contentTypes?.[key];
    if (!actual) {
      problems.push({ file: "sourcebook-index.json", reason: `missing content type ${key}` });
      continue;
    }
    if (actual.label !== expected.label || actual.notation !== expected.notation) {
      problems.push({
        file: `sourcebook-index.json#/contentTypes/${key}`,
        reason: `expected ${expected.notation} ${expected.label}`,
      });
    }
  }

  const definedTemplates = new Map();
  for (const template of sourcebook.templates ?? []) {
    definedTemplates.set(template.id, template);
  }

  const usedTemplates = new Set();
  collectRelatedTemplates(sourcebook, (templateId, trail) => {
    usedTemplates.add(templateId);
    if (!definedTemplates.has(templateId)) {
      problems.push({
        file: `sourcebook-index.json#/${trail.join("/")}`,
        reason: `template reference is not defined: ${templateId}`,
      });
    }
  });

  for (const pillar of sourcebook.pillars ?? []) {
    if (!Array.isArray(pillar.changeHistory) || pillar.changeHistory.length === 0) {
      problems.push({ file: `sourcebook-index.json#/${pillar.code}`, reason: "missing change history" });
    }
    for (const item of pillar.changeHistory ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date ?? "") || !item.summary) {
        problems.push({
          file: `sourcebook-index.json#/${pillar.code}/changeHistory`,
          reason: "change history entries need a YYYY-MM-DD date and summary",
        });
      }
    }
    for (const section of pillar.sections ?? []) {
      for (const clause of section.clauses ?? []) {
        const templateIds = clause.relatedTemplates ?? [];
        if (!Array.isArray(templateIds)) {
          problems.push({
            file: `sourcebook-index.json#/${clause.id}`,
            reason: "relatedTemplates must be an array when present",
          });
        }
      }
    }
  }

  for (const [templateId, template] of definedTemplates) {
    if (!usedTemplates.has(templateId)) {
      problems.push({
        file: `sourcebook-index.json#/templates/${templateId}`,
        reason: "template is defined but not referenced by any clause",
      });
    }

    const templatePath = path.join(sourcebookDir, template.path.replace(/^\/sourcebook\//, ""));
    if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isFile()) {
      problems.push({
        file: `sourcebook-index.json#/templates/${templateId}`,
        reason: `template file not found: ${template.path}`,
      });
    }
  }

  const indexedTemplateFiles = new Set(
    [...definedTemplates.values()].map((template) => path.basename(template.path)),
  );
  const templateDir = path.join(sourcebookDir, "templates");
  if (fs.existsSync(templateDir)) {
    for (const entry of fs.readdirSync(templateDir, { withFileTypes: true })) {
      if (entry.isFile() && !indexedTemplateFiles.has(entry.name)) {
        problems.push({
          file: `templates/${entry.name}`,
          reason: "template file is not registered in sourcebook-index.json",
        });
      }
    }
  }
}

function validateSourcebookQuality({
  sourcebookDir,
  govukSourcebookDir,
  sourcebookIndexPath,
} = {}) {
  const problems = [];

  validateHtmlQuality(
    {
      dir: sourcebookDir,
      label: "docs/devops/sourcebook",
      recursive: false,
      requireChangeHistory: (file) => file !== "index.html",
    },
    problems,
  );

  validateHtmlQuality(
    {
      dir: govukSourcebookDir,
      label: "public/pages/sourcebook",
      recursive: true,
      requireChangeHistory: (file) => file !== "index.html",
    },
    problems,
  );

  validateSourcebookModel({ sourcebookIndexPath, sourcebookDir }, problems);

  if (problems.length > 0) {
    for (const { file, reason } of problems) {
      console.error(`sourcebook: quality gate failed in ${file}: ${reason}`);
    }
    throw new Error(
      `sourcebook: ${problems.length} quality gate failure(s) found; first: ${problems[0].reason}`,
    );
  }
}

export function validateSourcebookLinks({
  sourcebookDir = SOURCEBOOK_DIR,
  govukSourcebookDir = GOVUK_SOURCEBOOK_DIR,
  sourcebookIndexPath = SOURCEBOOK_INDEX_PATH,
  validateQualityGates = sourcebookDir === SOURCEBOOK_DIR,
} = {}) {
  if (!fs.existsSync(sourcebookDir)) {
    throw new Error(`sourcebook: directory not found: ${sourcebookDir}`);
  }

  const htmlFiles = listHtmlFiles(sourcebookDir);

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
        broken.push({ file, href, reason: "placeholder href is not allowed" });
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
    throw new Error(
      `sourcebook: ${broken.length} broken link(s) found; first: ${broken[0].reason}`,
    );
  }

  if (validateQualityGates) {
    validateSourcebookQuality({ sourcebookDir, govukSourcebookDir, sourcebookIndexPath });
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
