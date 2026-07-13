# GA4 collection CSP correction

- Branch: `fix/allow-ga4-collection-csp` requires an operational trace.
- Evidence: GA4's published Google tag loaded `gtag.js`, but the browser blocked its `page_view` request to `region1.google-analytics.com/g/collect` under `connect-src`.
- Decision: follow Google's current GA4 CSP guidance with bounded Google Analytics host wildcards in `connect-src` and `img-src`, consistently in the Pages Worker and static headers.
- Scope: CSP and regression coverage, the related CSP learning, and removal of two redundant inline GTM bootstraps identified in Codex review; no analytics payload, event, consent or tag-manager configuration changes.
- Residual risk: the existing GTM harm register entry still requires privacy, consent, data-flow and tested opt-out escalation before non-essential analytics is enabled.
- Validation: results are recorded in the accompanying JSON trace.
