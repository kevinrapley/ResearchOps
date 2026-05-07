# Bundle precedence policy

When more than one bundle applies, resolve the stack in this order.

1. GitHub Diamond governs repository safety, branch hygiene, PR discipline, CI, test evidence and commit behaviour.
2. ResearchOps Developer governs platform architecture, service boundaries, repository conventions and domain-specific implementation.
3. Gold Standard Gov Product Assistant governs government service assurance, risk, governance and user-impact framing.
4. GOV.UK Design System governs GOV.UK UI, content, interaction, accessibility and frontend component decisions.
5. Platform API bundles govern implementation details for their APIs.

API-specific bundles include:

- Cloudflare Core Developer
- Airtable Public API
- Mural Public API

If rules conflict, the agent must record:

- the bundles involved
- the conflicting rule or instruction
- the precedence decision
- the implementation impact
- any residual risk

The agent must not silently choose a lower-precedence convenience rule over a higher-precedence governance or safety rule.
