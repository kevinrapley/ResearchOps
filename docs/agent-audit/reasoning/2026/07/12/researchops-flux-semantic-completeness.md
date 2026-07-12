# ResearchOps Flux semantic completeness

The supplied production journey showed unlabeled Sourcebook links and a small set of project-dashboard controls. The correction adds controlled `data-flux-key` and `data-flux-role` attributes in the Nunjucks sources, then rebuilds the generated pages. Flux remains responsible for capture and interpretation.

Validation: `npm run build`, `npm test`, `npm run validate`, and `git diff --check`.
