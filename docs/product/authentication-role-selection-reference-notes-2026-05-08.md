# Authentication and role-selection reference notes

Date: 2026-05-08  
Related requirements: `docs/product/authentication-role-selection-requirements-2026-05-08.md`  
Status: supporting reference notes  
System-change boundary: no application code, configuration, D1 schema, Airtable schema or Cloudflare setting is changed by this document

## Purpose

These notes record the external guidance and platform documentation that should be re-checked before implementing authentication and role-based access control.

The requirements document is the ResearchOps product requirement record. This file is a reference companion for implementation planning.

## GOV.UK account creation guidance

The GOV.UK Design System account pattern says accounts should be provided when users need to regularly access or update their data. It also says not to create accounts if the service can be usable without them.

For ResearchOps, accounts are justified because users must return to govern research records, access sensitive participant data, approve studies, review findings and record safeguarding activity.

Implementation implications:

- use the phrase “Create an account”
- separate account creation from sign-in
- make the sign-up process clear
- avoid asking for duplicate information
- avoid CAPTCHA-like security measures where possible
- let users use as much of the service as possible before account creation, where safe

Reference: https://design-system.service.gov.uk/patterns/create-accounts/

## GOV.UK pattern coverage

The GOV.UK Design System includes patterns for account-adjacent tasks such as creating accounts, creating usernames, confirming email addresses, confirming phone numbers, recovering from validation errors, navigating a service and completing multiple tasks.

Implementation implications:

- use GOV.UK patterns for account, email confirmation and recovery journeys where the service owns those flows
- use clear error and recovery routes rather than technical authentication language
- avoid long or unexplained role dropdowns

Reference: https://design-system.service.gov.uk/patterns/

## Cloudflare Access JWT validation

Cloudflare Access sends an application token as the `Cf-Access-Jwt-Assertion` request header. Cloudflare documentation recommends validating that header rather than relying on the cookie because the cookie is not guaranteed to be passed.

Cloudflare signs Access tokens with a key pair unique to the account. The Worker can validate the JWT against the account public key and the application AUD tag.

Implementation implications:

- validate `Cf-Access-Jwt-Assertion` in the Worker when Access protects the application
- store the team domain and application AUD tag as configured environment values or secrets as appropriate
- map the validated identity to a D1 user
- use D1 roles for ResearchOps authorisation

Reference: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

## Cloudflare Access cookies and sessions

Cloudflare Access uses JWT-based authorisation cookies. Cloudflare describes a team-domain session token and an application-domain token. Application tokens may be used to validate requests on the origin.

Implementation implications:

- explain logout behaviour where Access or the identity provider session may persist
- design timeout and re-authentication states carefully
- avoid conflating identity-provider session, Access session and ResearchOps application state in the UI

Reference: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/

## D1 Worker binding

Cloudflare D1 is accessed from Workers through environment bindings. Worker code can query the D1 database from the `env` binding, commonly `env.DB` when `DB` is the configured binding name.

Implementation implications:

- bind a D1 database to the Worker before implementing identity storage
- keep D1 as the application identity, role and audit control plane
- avoid querying Airtable for every authorisation decision

Reference: https://developers.cloudflare.com/d1/worker-api/d1-database/

## D1 database binding configuration

Cloudflare D1 requires Worker bindings in Wrangler configuration or dashboard setup. The binding connects the Worker to the D1 database.

Implementation implications:

- future implementation PRs must include environment-specific D1 binding design
- preview and production environments must not accidentally share sensitive production identity data unless explicitly intended
- migrations must be planned separately from requirements documentation

Reference: https://developers.cloudflare.com/d1/get-started/

## Cloudflare Workers secrets

Cloudflare Workers secrets are encrypted text bindings for sensitive values such as API keys and auth tokens. Cloudflare warns not to use plaintext `vars` for sensitive information in Wrangler configuration.

Implementation implications:

- store IdP client secrets, Turnstile secret keys, API tokens and signing secrets as Cloudflare secrets
- do not commit secrets to the repository
- validate required secrets before deployment in later implementation work

Reference: https://developers.cloudflare.com/workers/configuration/secrets/

## Cloudflare Turnstile server-side validation

Cloudflare Turnstile requires server-side validation. The client-side widget alone does not protect forms. Tokens expire after 300 seconds and are single use.

Implementation implications:

- if Turnstile protects public account creation or login flows, the Worker must call Siteverify server-side before continuing
- do not treat Turnstile as a complete abuse-prevention system
- design accessible fallback and recovery routes

Reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## Cloudflare Agents boundary

Cloudflare Agents may be useful for admin guidance, audit explanation, role-configuration assistance or summarising trace events.

They must not become the deterministic authorisation engine.

Implementation implications:

- authorisation decisions should remain in Worker and D1 logic
- Agents can explain or assist but should not grant access, reveal PII or approve governed artefacts without deterministic permission checks
- any Agent-assisted admin action must be auditable

Reference: https://developers.cloudflare.com/agents/

## Implementation caution

Cloudflare, identity-provider and GOV.UK guidance can change. Before implementation begins, the delivery team must re-check the current official documentation and update this reference file if needed.
