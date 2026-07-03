# ResearchOps incident response runbooks

These runbooks describe the first response for likely ResearchOps incidents. They are written for practitioners who need to move quickly, preserve evidence and route the incident to the right Home Office roles.

They do not replace Home Office security, privacy, legal or operational incident procedures. If there is a conflict, the Home Office procedure wins and this record should be updated afterwards.

## Common rules

Use these rules for every incident:

1. Start an incident record as soon as the issue is suspected.
2. Preserve evidence before making broad changes.
3. Contain the issue without destroying audit trails.
4. Escalate early when personal data, privileged access, production secrets, supplier systems or service availability may be affected.
5. Record what is known, what is assumed and what is still unknown.
6. Keep personal data out of chat, tickets and logs unless there is a clear operational need and an approved secure channel.
7. Close the incident only after lessons, follow-up actions and evidence links are recorded.

## Severity model

| Severity | Use when | Expected response |
| --- | --- | --- |
| Critical | Confirmed or strongly suspected unauthorised access, active data exfiltration, leaked production secret, high-risk personal data breach or live service compromise. | Immediate containment, security escalation and service-owner notification. Start breach assessment immediately. |
| High | Suspected personal data exposure, broken access control, failed retention deletion involving personal data, supplier incident affecting ResearchOps data or production data corruption. | Same working day containment and escalation. Start breach assessment if personal data may be involved. |
| Medium | Security control weakness, failed monitoring, non-production secret exposure, isolated audit-log issue or limited service degradation. | Triage, assign owner and agree treatment route. |
| Low | Minor process deviation with no known personal data, security or availability impact. | Record, review and decide whether preventive action is needed. |

## Runbook: suspected PII exposure

Trigger examples:

- participant record, contact detail, consent record, session note or journal entry visible to the wrong user
- personal data appears in a public page, repository artefact, screenshot, log, issue, pull request, email or exported file
- AI, Mural, Airtable or email integration receives personal data outside the agreed boundary

First actions:

1. Start the incident record and timestamp when ResearchOps became aware.
2. Capture the route, page, artefact, log entry or integration path without copying unnecessary personal data.
3. Restrict access to the exposed item or route.
4. Preserve relevant audit events, deployment version, request identifiers and access-control state.
5. Escalate to the service owner, information asset owner, privacy representative and security representative.
6. Begin the personal data breach handling process.

Evidence to retain:

- where the data appeared
- data classes affected
- number or type of people affected
- who could access it
- containment action and timing
- decision on ICO and affected-person notification
- follow-up action to prevent recurrence

## Runbook: unauthorised access or broken permission

Trigger examples:

- user can access a project, study, participant, journal, repository record or admin action outside their role
- disabled account can still use an authenticated route
- route permission gate is missing or misconfigured

First actions:

1. Preserve the user, team, route, request and audit context.
2. Disable or restrict the affected access path.
3. Check whether data was viewed, changed, exported or deleted.
4. Review recent deployment and permission changes.
5. Escalate to security and the service owner.
6. Start the personal data breach handling process if personal data may have been accessed.

Evidence to retain:

- affected routes and records
- account and role state at the time of access
- audit events and request traces
- fix commit, test evidence and deployment evidence
- access review outcome

## Runbook: leaked integration token, OAuth state or production secret

Trigger examples:

- Cloudflare, GitHub, Mural, Airtable, email, OpenAI or other provider secret appears in logs, code, screenshots, issues, pull requests or local output
- OAuth state, session token or callback secret is suspected to be predictable, reused or disclosed

First actions:

1. Do not paste the secret into tickets, chat or commit history.
2. Record the secret type and where it was seen without recording the secret value.
3. Revoke or rotate the affected secret through the approved owner.
4. Review provider access logs and recent API activity.
5. Redeploy or restart affected services if rotation requires it.
6. Assess whether the secret could have exposed personal data or privileged actions.

Evidence to retain:

- secret class and owner
- exposure location and time window
- rotation time and confirmation
- provider logs reviewed
- data exposure assessment
- follow-up control change

## Runbook: production data corruption or failed retention deletion

Trigger examples:

- participant, consent, journal, synthesis or repository records are unexpectedly changed or missing
- scheduled retention deletion fails or deletes the wrong records
- migration or deployment changes D1 or KV data unexpectedly

First actions:

1. Stop the affected write path if corruption may continue.
2. Preserve affected record identifiers, migration versions and deployment evidence.
3. Identify whether personal data has been lost, altered, disclosed or retained longer than agreed.
4. Escalate to service owner, technical maintainer, privacy representative and security representative.
5. Decide whether backup, restore or manual correction is safer than live repair.
6. Start breach handling if personal data integrity, confidentiality or availability may be affected.

Evidence to retain:

- affected data classes and stores
- migration, deployment or retention job details
- before and after state where available
- restore or correction decision
- affected user or participant impact
- prevention action

## Runbook: supplier or integration incident

Trigger examples:

- Cloudflare, GitHub, Airtable, Mural, email or AI provider reports a security incident
- supplier availability or integrity issue affects ResearchOps data
- provider changes subprocessors, regions or retention behaviour in a way that affects the boundary

First actions:

1. Record the supplier notice, time received and affected service.
2. Map the supplier issue to ResearchOps data flows and data classes.
3. Confirm whether ResearchOps data is affected, potentially affected or not affected.
4. Escalate to service owner, supplier owner, information asset owner and security representative.
5. Preserve supplier notices, status updates and assurance evidence.
6. Start breach handling if personal data may be affected.

Evidence to retain:

- supplier communications
- affected integration path
- data exposure or availability assessment
- supplier assurance evidence
- ResearchOps mitigation and communication decisions

## Runbook: unavailable service or degraded access

Trigger examples:

- users cannot access ResearchOps pages or authenticated workflows
- Cloudflare deployment, Worker route, D1, KV or provider dependency is unavailable
- release blocks access to consent, participant, journal or repository workflows

First actions:

1. Confirm affected pages, routes, data stores and user groups.
2. Check deployment, Cloudflare status, Worker errors and recent release changes.
3. Decide whether rollback, temporary disablement or degraded operation is required.
4. Escalate to service owner and technical maintainer.
5. Assess whether personal data availability risk or missed retention action creates breach handling obligations.
6. Record user impact and recovery timing.

Evidence to retain:

- incident start and end time
- affected users and workflows
- root cause and recovery action
- rollback or fix evidence
- communication decisions
- follow-up reliability actions

## Post-incident review

Every high or critical incident needs a short review covering:

- what happened
- how it was detected
- how long containment took
- whether the right people were involved
- what evidence was retained
- whether breach handling was started at the right time
- what will change in controls, monitoring, documentation or training

