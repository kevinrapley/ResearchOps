# Generated GOV.UK HTML Policy

Cloudflare Pages currently publishes the committed `public/` directory. Generated GOV.UK HTML in `public/index.html` and `public/pages/**/index.html` therefore remains committed source for the current deployment contract.

Do not hand-edit generated GOV.UK HTML. Edit the Nunjucks templates or publisher inputs, then run the GOV.UK page publisher so committed HTML, templates and tests stay in step while generated HTML remains committed.

route-state tests remain the guardrail for route behaviour, generated page publication and workflow state. Tests that need generated GOV.UK HTML publish the requested route through the in-memory output adapter. A parity test checks every final, post-normalised page byte-for-byte against the committed output.

Generated HTML diffs should still be reviewed while Cloudflare Pages publishes committed files.

When deployment can run `npm run build` before publishing, generated GOV.UK HTML should become a build artefact instead of hand-reviewed source. At that point the publish workflow should build the pages, upload or publish the generated output, ignore the generated HTML in Git, and keep review focused on templates, renderer code and route-state tests.
