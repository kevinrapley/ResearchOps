/**
 * @file public/js/richtext.js
 * @summary Markdown → Airtable Rich Text adapter (browser).
 * Airtable Rich Text accepts Markdown. This normalises Markdown consistently.
 */

/**
 * Normalise Markdown for Airtable Rich Text fields.
 * - Normalises line endings to "\n"
 * - Trims outer whitespace
 * - Collapses >2 blank lines to 2
 * - Converts tabs to 2 spaces
 * - Trims trailing spaces at line ends
 * @param {string} markdown
 * @param {{collapseBlank?:boolean, tabSize?:number}} [opts]
 * @returns {string}
 */
export function mdToAirtableRich(markdown, opts = {}) {
  const tabSize = Math.max(1, opts.tabSize ?? 2);
  const collapseBlank = opts.collapseBlank ?? true;

  let md = String(markdown ?? "");

  // normalise line Endings
  md = md.replace(/\r\n?/g, "\n");
  // tabs → spaces
  md = md.replace(/\t/g, " ".repeat(tabSize));
  // trim trailing spaces (per line)
  md = md.split("\n").map(l => l.replace(/[ \t]+$/g, "")).join("\n");
  // collapse 3+ blank lines → 2
  if (collapseBlank) md = md.replace(/\n{3,}/g, "\n\n");
  // outer trim
  md = md.trim();

  return md;
}
