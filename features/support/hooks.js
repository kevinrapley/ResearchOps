import { Before, After, AfterAll, AfterStep } from '@cucumber/cucumber';
import fs from 'node:fs/promises';
import path from 'node:path';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

const REPORTS_DIR = 'reports';
const SHOTS_DIR = path.join(REPORTS_DIR, 'screenshots');     // raw screenshots (for HTML report)
const SITE_DIR = 'reports-site';                              // static site we’ll publish via GitHub Pages

// In-memory run manifest that we'll turn into an index.html
const runManifest = {
  startedAt: new Date().toISOString(),
  scenarios: [] // { feature, name, slug, steps: [{ idx, text, shotRel }] }
};

Before(async function ({ pickle, gherkinDocument }) {
  // Derive feature & scenario names
  const featureName = gherkinDocument.feature?.name || 'Feature';
  const scenarioName = pickle.name || 'Scenario';
  this.__featureName = featureName;
  this.__scenarioName = scenarioName;
  this.__scenarioSlug = `${slugify(featureName)}__${slugify(scenarioName)}`;
  this.__stepIndex = 0;
  this.__steps = []; // { idx, text, shotRel }
});

AfterStep(async function ({ pickleStep /*, result */ }) {
  // Take a screenshot after every step
  const idx = ++this.__stepIndex;
  const stepText = pickleStep?.text || `(step ${idx})`;
  const fname = `${this.__scenarioSlug}__${String(idx).padStart(3, '0')}--${slugify(stepText)}.png`;
  const rel = path.join('screenshots', fname);
  const abs = path.join(SHOTS_DIR, fname);

  await fs.mkdir(SHOTS_DIR, { recursive: true });
  await this.page.screenshot({ path: abs, fullPage: true });

  this.__steps.push({ idx, text: stepText, shotRel: rel });
});

After(async function () {
  // Add scenario block to manifest
  runManifest.scenarios.push({
    feature: this.__featureName,
    name: this.__scenarioName,
    slug: this.__scenarioSlug,
    steps: this.__steps.slice()
  });
});

AfterAll(async function () {
  // Build a tiny static site that references the screenshots + cucumber HTML
  await fs.mkdir(SITE_DIR, { recursive: true });

  // Copy cucumber HTML report into the site (if present)
  const cucumberHtml = path.join(REPORTS_DIR, 'cucumber-report.html');
  try {
    await fs.copyFile(cucumberHtml, path.join(SITE_DIR, 'cucumber-report.html'));
  } catch { /* ignore if missing */ }

  // Copy screenshots directory
  try {
    await fs.mkdir(path.join(SITE_DIR, 'screenshots'), { recursive: true });
    // Cheap directory copy: list and copy files if exists
    const files = await fs.readdir(SHOTS_DIR);
    await Promise.all(files.map(f =>
      fs.copyFile(path.join(SHOTS_DIR, f), path.join(SITE_DIR, 'screenshots', f))
    ));
  } catch { /* ignore if none */ }

  // Write a minimal index.html with a visual walkthrough
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BDD Walkthrough</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; margin:24px; line-height:1.45}
    header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
    .badge{background:#eef;border:1px solid #99c;border-radius:6px;padding:6px 10px}
    h2{margin-top:32px;border-bottom:1px solid #eee;padding-bottom:6px}
    .step{border:1px solid #eee;border-radius:8px;margin:12px 0;overflow:hidden}
    .step .meta{background:#fafafa;padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333}
    .step img{display:block;width:100%;max-width:1200px;height:auto}
    .links a{margin-right:12px}
    .empty{color:#889}
    .scenario{margin-bottom:36px}
  </style>
</head>
<body>
  <header>
    <h1>BDD Visual Walkthrough</h1>
    <div class="links">
      <a class="badge" href="./cucumber-report.html">Open Cucumber HTML report</a>
    </div>
  </header>
  <p class="badge">Run started: ${runManifest.startedAt}</p>
  ${runManifest.scenarios.length === 0 ? '<p class="empty">No scenarios captured.</p>' : ''}
  ${runManifest.scenarios.map(sc => `
    <section class="scenario" id="${sc.slug}">
      <h2>${sc.feature} — ${sc.name}</h2>
      ${sc.steps.map(st => `
        <div class="step">
          <div class="meta">Step ${st.idx}: ${st.text}</div>
          <img loading="lazy" src="${st.shotRel}" alt="Step ${st.idx}: ${st.text}" />
        </div>
      `).join('')}
    </section>
  `).join('')}
</body>
</html>`;

  await fs.writeFile(path.join(SITE_DIR, 'index.html'), html, 'utf8');
});
