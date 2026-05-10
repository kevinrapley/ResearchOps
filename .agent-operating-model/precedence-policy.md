# Bundle precedence policy

When more than one bundle applies, resolve the stack in this order.

1. `github-diamond` governs repository safety, branch hygiene, PR discipline, CI, test evidence and commit behaviour.
2. `researchops-developer-control` governs platform architecture, service boundaries, repository conventions, Cloudflare runtime work and ResearchOps-specific implementation.
3. `multi-functional-team` governs government service assurance, risk, governance, ethics, harm and user-impact framing.
4. `govuk-design-system` governs GOV.UK UI, content, interaction, accessibility and frontend component decisions.
5. Platform API bundles govern implementation details for their APIs.

Canonical platform API bundles are:

- `airtable-public-api`
- `mural-public-api`

The canonical bundle root is:

```text
.agent-operating-model/bundles/
```

If rules conflict, the agent must record:

- the bundles involved
- the conflicting rule or instruction
- the precedence decision
- the implementation impact
- any residual risk

The agent must not silently choose a lower-precedence convenience rule over a higher-precedence governance or safety rule.
