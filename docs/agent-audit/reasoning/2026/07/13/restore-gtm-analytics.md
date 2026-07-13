# Restore live GTM and GA4 collection

- Branch: `fix/restore-gtm-analytics` requires an operational trace.
- Evidence: the deployed fail-closed CSP blocked Tag Manager on every checked route, even though the GTM markup was present across the static site except the intentional legacy synthesis redirect.
- Decision: reverse PR #494's fail-closed changes using Git's non-destructive revert, restoring the already tested GA4 and GTM allowlist from main.
- Scope: restore the prior runtime, static-header, test and governance state; keep the duplicate-bootstrap protection introduced in main.
- Residual risk: the restored harm and gap registers continue to require privacy, consent, data-flow and opt-out escalation for non-essential analytics.
- Validation: results are recorded in the accompanying JSON trace.
