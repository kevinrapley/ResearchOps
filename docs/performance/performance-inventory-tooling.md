# Performance inventory tooling

The ResearchOps performance inventory command gives a repeatable first-pass view of public frontend weight and loading risks.

It supports the follow-up work identified in `docs/performance/initial-load-audit.md`.

## Commands

Print a Markdown report to stdout:

```bash
npm run audit:performance
```

Write the report to `docs/performance/performance-inventory.md`:

```bash
npm run audit:performance:write
```

Print JSON for local analysis:

```bash
npm run audit:performance -- --json
```

Override thresholds:

```bash
npm run audit:performance -- --max-asset-kb=256 --max-html-kb=150 --max-inline-script-kb=25
```

## What it reports

The script scans the `public/` directory and reports:

- the largest public files
- total public directory size
- rough gzip estimates for text assets
- file size grouped by extension
- large file threshold flags
- inline script counts and inline script sizes in HTML files
- possible unused class and id selector tokens from `public/css/screen.css`

## How to use the output

Use the largest-file table to identify likely asset and route-weight candidates.

Use the inline-script table to prioritise route-specific JavaScript extraction. Large inline scripts are better moved into cacheable modules when behaviour can be preserved safely.

Use the CSS selector table as a rough review queue only. It is not a deletion list.

## CSS warning

The CSS check is static. It can produce false positives where class names are:

- created dynamically in JavaScript
- applied by future user states
- applied by included partials not present in the scanned corpus
- referenced by external or generated markup

Any CSS removal should be done in small route-scoped PRs with browser validation.

## Suggested follow-up sequence

1. Run `npm run audit:performance:write` on a fresh branch.
2. Review the largest inline-script routes.
3. Extract one route module at a time.
4. Add or update route-state tests for the changed route.
5. Only split CSS once the affected route has coverage.

## CI behaviour

`npm run validate` checks that the script exists, that package scripts are wired correctly, that the shell syntax is valid, and that the JSON mode runs successfully.
