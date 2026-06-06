# Generated GOV.UK HTML Policy

Cloudflare Pages currently publishes the committed `public/` directory. Generated GOV.UK HTML in `public/index.html` and `public/pages/**/index.html` therefore remains committed source for the current deployment contract.

Do not hand-edit generated GOV.UK HTML. Edit the Nunjucks templates or renderer inputs, then run the GOV.UK page renderer so committed HTML, templates and tests stay in step while generated HTML remains committed.

route-state tests remain the guardrail for route behaviour, generated page registration and workflow state. Tests that need to inspect renderer-managed GOV.UK pages should load those pages from the Nunjucks templates and renderer registry rather than reading the committed generated HTML directly.

Generated HTML diffs should still be reviewed while Cloudflare Pages publishes committed files.

When deployment can run `npm run build` before publishing, generated GOV.UK HTML should become a build artefact instead of hand-reviewed source. At that point the publish workflow should build the pages, upload or publish the generated output, ignore the generated HTML in Git, and keep review focused on templates, renderer code and route-state tests.
