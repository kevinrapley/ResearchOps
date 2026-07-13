# GTM image CSP correction

- Branch: `fix/allow-gtm-image-csp`
- Task: permit GTM's `https://www.googletagmanager.com/td` image request after a browser CSP violation.
- Decision: add the exact GTM origin to `img-src` in the Pages Worker and all static HTML header policies. This preserves a narrow source allowlist and avoids `'unsafe-inline'` or wildcard origins.
- Validation: the GTM CSP route-state test asserts the GTM origin appears in `img-src`, `script-src` and `frame-src` for each static policy; focused and full repository validation results are recorded in the accompanying JSON trace.
- Residual risk: GTM tags remain subject to the existing consent and privacy escalation recorded for PR #492.
