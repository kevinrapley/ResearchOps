# GTM consent fail-closed correction

- Branch: `fix/gate-gtm-beacon-consent`
- Task: address the unresolved Codex review on merged PR #493 by preventing GTM activation while the repository's analytics-consent governance gap remains open.
- Assumption: no approved GTM consent mechanism, tag inventory, data-flow record or opt-out path exists because `gap-register.yaml` records each prerequisite as unresolved.
- Decision: remove Google Tag Manager from the Worker and static Content Security Policy allowlists. The existing markup remains dormant and Flux Behaviour remains independently allowed by CSP.
- Test-contract sweep: updated the GTM route-state assertions from activation to fail-closed behaviour; checked Worker and static header policies, image beacons and frames.
- Residual risk: dormant GTM markup remains in rendered pages and must not be activated until privacy and service-owner approval is recorded and consent/withdrawal behaviour is tested.
