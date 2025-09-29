// scripts/restructure-pages.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = "public";
const PAGES_DIR = path.join(ROOT, "pages");
const PAGES = [
  "consent",
  "notes",
  "project-dashboard",
  "projects",
  "search",
  "sessions",
  "start",
  "study",
  "synthesis",
];

// 1) Ensure pages directory exists
fs.mkdirSync(PAGES_DIR, { recursive: true });

// 2) Move files
for (const name of PAGES) {
  const src = path.join(ROOT, `${name}.html`);
  const dstDir = path.join(PAGES_DIR, name);
  const dst = path.join(dstDir, "index.html");

  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Skipping ${name} (not found: ${src})`);
    continue;
  }
  fs.mkdirSync(dstDir, { recursive: true });
  fs.renameSync(src, dst); // use `git mv` manually if you want history preserved

  console.log(`✅ Moved: ${src} → ${dst}`);
}

// 3) Walk all files under /public and rewrite links that point to the moved pages
const extsToRewrite = new Set([".html", ".htm", ".js", ".mjs", ".jsx", ".tsx", ".ts", ".css", ".json"]);

const pageTargetsHtml = new Map(
  PAGES.map((name) => [
    `${name}.html`, // match file form
    `./pages/${name}`, // new base path
  ])
);

// Simple rewrite rules for href/src/action attributes and import() strings
const ATTR_REGEXES = [
  // href="X", src="X", action="X"
  { re: /(href|src|action)\s*=\s*"(.*?)"/gi, q: '"' },
  { re: /(href|src|action)\s*=\s*'(.*?)'/gi, q: "'" },
  // import("X") or fetch("X")
  { re: /(import|fetch)\s*\(\s*"(.*?)"\s*\)/gi, q: '"' },
  { re: /(import|fetch)\s*\(\s*'(.*?)'\s*\)/gi, q: "'" },
];

// Recursively read files
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!extsToRewrite.has(ext)) continue;
      rewriteFile(full);
    }
  }
}

function rewriteUrl(urlStr) {
  // ignore absolute urls and anchors
  if (/^(https?:)?\/\//i.test(urlStr) || urlStr.startsWith("#") || urlStr.startsWith("mailto:") || urlStr.startsWith("tel:")) {
    return urlStr;
  }

  // normalise: strip leading ./ or ../ segments when possible (best effort)
  // we only care about the last path segment to catch "xyz.html"
  const clean = urlStr.replace(/^[.\/]+/, "");
  for (const [oldHtml, newBase] of pageTargetsHtml.entries()) {
    // match exact file or with query/hash
    const m = clean.match(new RegExp(`^${oldHtml}(?:([?#].*)|$)`, "i"));
    if (m) {
      const tail = m[1] || "";
      return `${newBase}${tail}`;
    }
  }

  return urlStr;
}

function rewriteFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const { re, q } of ATTR_REGEXES) {
    src = src.replace(re, (full, attrOrFn, val) => {
      const next = rewriteUrl(val);
      if (next !== val) {
        changed = true;
        if (attrOrFn === "import" || attrOrFn === "fetch") {
          return `${attrOrFn}(${q}${next}${q})`;
        }
        return `${attrOrFn}=${q}${next}${q}`;
      }
      return full;
    });
  }

  if (changed) {
    fs.writeFileSync(filePath, src);
    console.log(`✍️  Rewrote links in: ${filePath}`);
  }
}

// Kick off rewrite pass
walk(ROOT);

console.log("\n✅ All done. New URLs look like: ./pages/study?pid=...&sid=...");
