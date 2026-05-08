# Authentication and role-selection requirements

**Date:** 2026-05-08  
**Status:** requirements and architecture discussion  
**Scope:** product, service, UI, Cloudflare, D1 and Airtable requirements  
**System-change boundary:** no application code, configuration, schema migration, Airtable change or Cloudflare setting is changed by this document

## Purpose

Authentication and role selection are enabling capabilities for three P1 backlog items.

This document records the requirements discussion, team transcript, implementation methods, strengths, weaknesses and capability matrix for account creation, authentication, role boundaries, login, logout and identity control.

## Source dependencies

This work is a prerequisite for:

- `ROPS-DC-P1-003`: Make pseudonymised participant views the default.
- `ROPS-DC-P1-005`: Define governance roles and decision ownership.
- `ROPS-DC-P1-007`: Embed safeguarding prompts and escalation routes.

## Core requirement

ResearchOps must allow a user to sign up for an account, authenticate, join or create a team, and hold one or more roles.

The role and permission model must determine whether the user can:

- access participant PII
- reveal identifiable data
- author governed research data
- edit governed research data
- review findings
- approve studies or findings
- own accepted recommendations
- view safeguarding flags
- record safeguarding risks
- resolve safeguarding concerns
- view audit events
- manage team members and roles

## Team assembled

- User Researcher
- Research Operations
- GOV.UK Specialist
- Interaction Designer
- Product Owner
- Service Designer
- Accessibility Specialist
- Security Architect
- Cloudflare Architect
- Data Architect

## Full @transcript

### Round 1: Why authentication is a prerequisite

@UserResearcher: Authentication is needed because the platform is moving from general research support into governed research activity. A user will need to return over time, edit records, approve research artefacts, view protected participant data and respond to safeguarding information. A generic anonymous workflow cannot safely support those tasks. The account journey should still be proportionate. Users should understand why they are being asked to create an account and why their role matters.

@ResearchOperations: Authentication is the foundation for ResearchOps accountability. Without a known user, the platform cannot reliably show who approved a study, who edited a recommendation, who recorded safeguarding risk, who accessed identifiable participant data or who owns a decision. The account model is therefore not only security infrastructure. It is an operational control.

@GOVUKSpecialist: The service should avoid asking people to create an account until it is needed. But this service does have a justified need for accounts because users return, manage sensitive records and make governed decisions. The interface should use plain language such as “Create an account” and “Sign in”. It should not use vague labels such as “Register” or technical labels such as “Authenticate”.

@InteractionDesigner: The design should separate identity, team membership and role. Creating an account proves who the user is. Joining a team establishes where they work. Role selection controls what they can do. Combining all three in one overloaded sign-up page will increase errors.

@ProductOwner: This should become a new enabling epic. It blocks the P1 requirements for PII, governance and safeguarding. It is not simply a supporting feature. It is a platform capability that other critical controls depend on.

@ServiceDesigner: A person may have different responsibilities in different contexts. A user can be a Researcher on one study, an Observer on another and a Product Owner for a different project. The model should support role scope by team, project or study where needed.

@AccessibilitySpecialist: Account journeys often create disproportionate access barriers. Password rules, MFA, timed codes, magic links, permission-denied pages and session timeouts all need accessible design. Error messages must explain the problem and recovery route in plain English.

@SecurityArchitect: The platform must separate authentication from authorisation. Authentication answers “who is this person?” Authorisation answers “what can this person do here?” The Worker must enforce authorisation server-side on every protected endpoint.

@CloudflareArchitect: Cloudflare can support several routes. Cloudflare Access can protect the application and provide identity through an Access JWT. External OIDC can also work. D1 should hold application roles and permissions. The Worker should be the policy enforcement point.

@DataArchitect: D1 should be the identity and permission control plane. Airtable can continue to hold research data, but Airtable should not decide whether a user is allowed to see PII or approve governed objects. The Worker should authorise first, then call Airtable.

### Round 2: Identity, team and role model

@UserResearcher: Users need clear explanations of role consequences. The service should explain that roles control what research data they can see and what decisions they can make. This is important for trust because people may otherwise feel blocked without understanding why.

@ResearchOperations: Roles should map to ResearchOps activities. Suggested roles include Researcher, Research Lead, Research Operations, Product Owner, Service Designer, Interaction Designer, Accessibility Specialist, Reviewer, Approver, Safeguarding Lead, Observer and Team Admin.

@GOVUKSpecialist: The interface should avoid exposing raw permission codes. Users should see task-based descriptions such as “Can approve a study” or “Can view participant contact details”. Internal permission codes are useful for D1 and tests, but not for users.

@InteractionDesigner: Role selection should be a guided step after identity verification. Users can request a role. Sensitive roles should require approval. A user should be able to see whether their role is active, pending, rejected or expired.

@ProductOwner: The minimum viable identity model needs user, team, membership, role, permission and audit. Anything less will make PII and safeguarding controls brittle.

@ServiceDesigner: The system should support scoped roles. Team-wide roles may be enough for early beta, but project-level or study-level roles will likely be needed for sensitive studies.

@AccessibilitySpecialist: Role selection should not be a long unexplained dropdown. Each role needs a description, key permissions and whether approval is required. Users who do not know their formal title should still be able to choose the right route.

@SecurityArchitect: New users should start with least privilege. They should not get PII access, approval rights or safeguarding visibility by default. Sensitive permissions should require explicit assignment and audit.

@CloudflareArchitect: Cloudflare Access or OIDC can establish identity. ResearchOps still needs its own role layer because the platform permissions are domain-specific. Identity provider groups can help, but they should not replace application permissions unless the mapping is deliberately governed.

@DataArchitect: Store identity provider accounts separately from users. A user may have more than one identity provider link over time. The stable internal user ID should be the key used in audit events and governed object metadata.

### Round 3: Account creation and sign-up form best practice

@UserResearcher: The user should not be asked for unnecessary information. Minimum account setup should capture email, display name and route into a team. Role should be requested with enough context for the user to choose correctly.

@ResearchOperations: Invitation-first is safer for internal ResearchOps teams. It prevents people joining the wrong team or granting themselves inappropriate access. Open sign-up may be useful later, but should create a pending state.

@GOVUKSpecialist: Sign-up should be clear and task-focused. Separate “Create an account” from “Sign in”. Explain what users need before they start. If the account is invitation-only, say so clearly and provide a recovery route.

@InteractionDesigner: Suggested journey for invited users: invitation link, identity verification, team confirmation, role confirmation or request, account setup complete. Suggested journey for open users: create account, verify email, create or request team access, request role, wait for approval.

@ProductOwner: Avoid building custom password authentication as the first route. It creates security and maintenance overhead. Passwordless, Cloudflare Access or external OIDC are better initial options.

@ServiceDesigner: External collaborators may not have the same identity provider as staff. The service needs a route for collaborators that does not weaken the core access model. Invitation-based passwordless access could support this.

@AccessibilitySpecialist: Avoid CAPTCHA where possible. If bot protection is required, use a less intrusive approach and provide clear recovery. Email verification, magic links and one-time codes must be usable with assistive technology and should not depend on colour or timed interaction alone.

@SecurityArchitect: Email verification is mandatory if email is used as an identifier. Magic links must be single-use, time-limited and protected from replay. If passwords are introduced later, password storage, reset, MFA and breach handling become significant obligations.

@CloudflareArchitect: If public forms exist, Cloudflare Turnstile can reduce automated abuse. The Worker must verify the Turnstile token server-side before creating an account or sending login email. Turnstile should not become the only abuse control.

@DataArchitect: Store account status separately from role status. An account can be active while a role request is pending. This makes onboarding and permission-denied states clearer.

### Round 4: Login, logout and session behaviour

@UserResearcher: Users should know who they are signed in as and what team context is active. This matters when researchers work across studies or teams.

@ResearchOperations: Team switching must be explicit. Accidental action in the wrong team could create serious operational errors, especially for participant data or safeguarding records.

@GOVUKSpecialist: Login and permission errors should be written in plain English. A failed sign-in should not leak whether an email exists. A permission failure should explain what the user can do next, such as ask a Team Admin.

@InteractionDesigner: Logout should be visible and predictable. If enterprise SSO is used, the sign-out page should explain whether the user has signed out of ResearchOps only or also from their organisation account.

@ProductOwner: Session expiry needs careful handling. Researchers may be in long sessions. The service should warn before expiry where possible and prevent data loss.

@ServiceDesigner: There are several session layers: identity provider session, Cloudflare Access session, ResearchOps application session and browser state. The user experience must make this simple.

@AccessibilitySpecialist: Timeout warnings must be announced to screen reader users, be keyboard operable and give enough time to respond. Avoid sudden loss of unsaved research notes.

@SecurityArchitect: Sensitive actions should support step-up checks. Viewing PII, approving a study or resolving safeguarding concerns are higher-risk than viewing a project summary.

@CloudflareArchitect: With Cloudflare Access, the Access session duration is configured in Access. The Worker can validate Access identity and then use D1 for application role checks. If OIDC is used directly, token validation and session storage become application responsibilities.

@DataArchitect: Store auth events separately from application events. Sign-in, logout and failed login are auth events. PII reveal, governed edit and safeguarding action are application audit events.

### Round 5: Cloudflare, D1 and Airtable responsibilities

@UserResearcher: Users should experience one coherent service. They should not need to understand which part is Cloudflare, D1 or Airtable. The service should explain boundaries only when it affects trust, error recovery or data handling.

@ResearchOperations: Airtable can remain the research operations data store. But sensitive checks must happen before Airtable records are returned. The Worker should redact or block before response data reaches the browser.

@GOVUKSpecialist: Technical errors should become service errors. “We cannot check your permission right now” is better than “D1 query failed”. “We cannot load participant records right now” is better than “Airtable API error”.

@InteractionDesigner: The UI should reflect permission state. Examples include “You can view pseudonymised details only”, “Request access to contact details”, “You can approve this study” and “This recommendation needs a decision owner”.

@ProductOwner: D1 is the natural control plane because ResearchOps already runs on Cloudflare. It can store users, teams, roles, permissions and audit events. Airtable can mirror some user-facing governance metadata, but enforcement should not depend on Airtable.

@ServiceDesigner: Think of D1 as the identity and authority layer. Think of Airtable as the research data layer. Think of the Worker as the policy enforcement point. This separation makes future migration easier.

@AccessibilitySpecialist: Permission-denied states should be designed as useful pages or panels. They should not be dead ends. They should explain what the user can still do and how to request access.

@SecurityArchitect: Secrets must be stored in Cloudflare secrets, not plaintext configuration. Worker code should treat every protected request as untrusted until identity and permission checks pass.

@CloudflareArchitect: Worker middleware should perform identity validation, D1 role lookup, permission evaluation and audit logging before any Airtable operation. Cloudflare Agents may support admin guidance or audit summarisation, but they must not be the deterministic access-control engine.

@DataArchitect: Airtable records can include fields such as Approved by User ID, Approved by Display Name and Governance status. The canonical permission data should remain in D1. Airtable should not be queried repeatedly for role checks because that creates latency and rate-limit risk.

### Round 6: Role boundaries for the P1 dependencies

@UserResearcher: PII should not be shown simply because someone is on the team. The interface should make sensitive data access deliberate, justified and visible.

@ResearchOperations: Permission groups should include participant PII, research authorship, governance review, governance approval, decision ownership, safeguarding visibility, team administration and audit review.

@GOVUKSpecialist: Use plain language descriptions. “Can view participant contact details” is clearer than “PII permission”. “Can approve study plans” is clearer than “Approver role”.

@InteractionDesigner: For participant records, pseudonymised information should be the default view. If a user has permission, a reveal control can expose identifiable data. The reveal should clearly signal that the action is sensitive.

@ProductOwner: For governance, every write action should record user ID, team ID, object ID, action and timestamp. Accepted recommendations should require a decision owner.

@ServiceDesigner: Safeguarding visibility should be scoped. A session may show a general “restricted safeguarding information exists” state to some users while detailed content is visible only to authorised users.

@AccessibilitySpecialist: Safeguarding flags must not rely on colour alone. They need text labels, accessible names and clear headings. Disclosure of sensitive details must be keyboard operable.

@SecurityArchitect: Roles should map to permissions. Avoid hard-coded checks like “if role equals approver”. Use permission checks like `governed.approve` or `safeguarding.view`.

@CloudflareArchitect: The Worker should expose a `/api/me/permissions` route for UI state, but server-side endpoints must still enforce permissions. Client-side hiding is convenience, not security.

@DataArchitect: Store permission changes as auditable events. If a user gains or loses access, later audit review must show who changed the permission and when.

### Round 7: Authentication route options

@UserResearcher: Enterprise sign-in works well for staff, but external collaborators may need a different route. The chosen path must match real team composition.

@ResearchOperations: Invitation-first plus enterprise SSO is operationally clean. It keeps teams controlled and reduces accidental access.

@GOVUKSpecialist: Federated login can simplify sign-in, but users must understand which account they are using. Avoid a confusing screen with many unexplained provider buttons.

@InteractionDesigner: Role selection should not be mixed into the login page. The login page proves identity. Role request and approval happen after sign-in.

@ProductOwner: A phased approach is best. Start with Cloudflare Access or OIDC plus D1 RBAC. Add passwordless invitations for collaborators when needed.

@ServiceDesigner: Enterprise IAM should be considered early. Offboarding, group membership, MFA and account recovery are easier when managed by the organisation.

@AccessibilitySpecialist: MFA must be inclusive. SMS, authenticator apps, passkeys and security keys each have access considerations. Provide alternatives and recovery paths.

@SecurityArchitect: Avoid custom passwords unless required. Passwordless, passkeys, OIDC or Access reduce custom security burden. If custom passwords are chosen, treat them as a significant security product.

@CloudflareArchitect: Cloudflare Access is strong for internal/private beta. External OIDC works for enterprise scale. Passwordless magic links can support collaborators. Passkeys are strong but more complex.

@DataArchitect: Whatever method is used, D1 should store identity links with provider, provider subject, email, verification state and internal user ID.

### Round 8: Recommended direction

@UserResearcher: The best user experience is organisation sign-in for staff, invitation-based access for collaborators and a clear role request or approval flow.

@ResearchOperations: Minimum viable control is authenticated user, team membership, role assignment, permission matrix and audit log.

@GOVUKSpecialist: Use account creation and sign-in language that users understand. Provide clear routes for users who cannot sign in, need access or do not know which role to request.

@InteractionDesigner: The first design should include create account, sign in, sign out, choose or request role, role pending approval, account settings, team settings and permission-denied pages.

@ProductOwner: This should be recorded as `ROPS-AUTH-P1-000: Authentication and role-based access control`. It is a prerequisite for `ROPS-DC-P1-003`, `ROPS-DC-P1-005` and `ROPS-DC-P1-007`.

@ServiceDesigner: Separate identity, team membership and permission. That separation allows internal staff, external collaborators and future organisations to use the platform without weakening access control.

@AccessibilitySpecialist: Build the account journey with accessible validation, focus management, timeout handling, non-colour status and clear recovery routes.

@SecurityArchitect: Recommended baseline is Cloudflare Access or OIDC for authentication, D1 for roles and audit, Worker middleware for authorisation and Airtable only behind the Worker.

@CloudflareArchitect: Cloudflare AI and Agents can help explain admin setup, summarise audit events or support guided role configuration. They must not be final arbiters of access. Deterministic Worker and D1 logic should enforce permissions.

@DataArchitect: D1 should store identity and permission truth. Airtable can mirror user-facing governance metadata, but D1 IDs should remain canonical for audit and authorisation.

## Requirements

### ROPS-AUTH-P1-000: Authentication and role-based access control

Purpose: allow users to create accounts, authenticate, join or create teams, request or hold roles and have those roles determine access to PII, governed authorship, decision ownership, reviewer rights, approver rights and safeguarding visibility.

Dependency relationship:

- Enables `ROPS-DC-P1-003`.
- Enables `ROPS-DC-P1-005`.
- Enables `ROPS-DC-P1-007`.

## Functional requirements

### ROPS-AUTH-001: Account creation

Users must be able to create an account or accept an invitation.

Acceptance criteria:

- Given a user is invited, when they follow the invitation link, then they can verify their identity and join the correct team.
- Given open sign-up is enabled, when a user creates an account, then the account is created in a pending or active state according to the governance model.
- Given a user creates an account, when creation succeeds, then email verification state is recorded.
- Given account creation fails, when the user sees the error, then the message explains what to fix in plain English.
- Given bot protection is enabled, when the user submits the form, then server-side token verification happens before account creation or email sending.

### ROPS-AUTH-002: Authentication

Users must be able to sign in through the chosen authentication route.

Acceptance criteria:

- Given a returning user signs in, then the Worker can identify a stable internal user ID.
- Given a user signs in through an external identity provider, then the provider subject is linked to a D1 user.
- Given a session expires, then the user is prompted to sign in again without losing saved work where feasible.
- Given sign-in fails, then the message does not leak whether the email exists.
- Given MFA is required, then the second factor or provider challenge is completed before access.

### ROPS-AUTH-003: Logout

Users must be able to sign out.

Acceptance criteria:

- Given a user signs out, then the local ResearchOps session is invalidated.
- Given enterprise SSO is used, then the service explains whether the wider identity-provider session may still exist.
- Given a signed-out user tries to access a protected page, then access is denied or the user is sent to sign in.
- Given logout fails, then the user sees a recovery route.

### ROPS-AUTH-004: Team membership

Users must belong to at least one team before accessing governed project data.

Acceptance criteria:

- Given a user accepts an invitation, then they join the inviting team.
- Given a user creates a team, then their team role is recorded.
- Given a user belongs to multiple teams, then the active team is visible.
- Given a membership is removed, then team data access is blocked on the next protected request.

### ROPS-AUTH-005: Role request and assignment

Users must be able to request or receive a role.

Acceptance criteria:

- Given a user has no role, then they are prompted to request one.
- Given a role requires approval, then it remains pending until approved.
- Given a role is active, then account settings show the role and main permissions.
- Given a role is rejected or expired, then the user sees status and next steps.
- Given role descriptions are shown, then they explain user tasks and sensitive access in plain English.

### ROPS-AUTH-006: Permission boundaries

Roles must map to permissions.

Core permissions:

- `participant.pii.view`
- `participant.pii.reveal`
- `governed.create`
- `governed.edit`
- `governed.review`
- `governed.approve`
- `recommendation.own`
- `safeguarding.view`
- `safeguarding.record`
- `safeguarding.resolve`
- `audit.view`
- `team.manage`
- `role.assign`

Acceptance criteria:

- Given a user lacks `participant.pii.view`, then only pseudonymised participant data is shown.
- Given a user lacks `governed.approve`, then approval actions are unavailable and API requests are denied.
- Given a user lacks `safeguarding.view`, then sensitive safeguarding details are hidden.
- Given client-side controls are hidden, when a user calls the API directly, then server-side authorisation still blocks the action.
- Given a permission changes, then the next protected request enforces the new state.

### ROPS-AUTH-007: PII reveal control

Identifiable participant data must require explicit permission.

Acceptance criteria:

- Given a participant is shown, then pseudonymised details are shown by default.
- Given an authorised user reveals identifiable data, then the reveal event is logged.
- Given identifiable data is displayed, then its sensitive nature is clear.
- Given a user lacks export permission, then identifiable export is blocked.
- Given audit is reviewed, then PII access shows user, object, time and reason.

### ROPS-AUTH-008: Governed authorship

Governed edits must record authorship.

Acceptance criteria:

- Given a user edits a governed object, then user ID, team ID, object ID and timestamp are recorded.
- Given a user creates an insight, then creator identity is recorded.
- Given a user edits a recommendation, then editor and change summary are recorded.
- Given an unauthenticated request edits a governed object, then the request is rejected.
- Given audit is viewed, then authorship is visible.

### ROPS-AUTH-009: Reviewer and approver rights

Review and approval must require explicit permission.

Acceptance criteria:

- Given a reviewer reviews a finding, then reviewer, status and date are recorded.
- Given an approver approves a study, then approver and approval date are recorded.
- Given a user lacks approver rights, then approval API requests are denied.
- Given governance status is missing, then the object shows governance incomplete.
- Given a review decision changes, then previous decisions remain auditable.

### ROPS-AUTH-010: Decision ownership

Accepted recommendations must have a decision owner.

Acceptance criteria:

- Given a recommendation is accepted, then a decision owner is required.
- Given a current user is decision owner, then ownership is visible.
- Given another authorised user views the recommendation, then owner and decision date are visible.
- Given no owner exists, then governance incomplete is shown.
- Given owner changes, then previous owner remains in audit history.

### ROPS-AUTH-011: Safeguarding visibility

Safeguarding details must be visible only to authorised users.

Acceptance criteria:

- Given a safeguarding flag exists, then authorised users can view the flag and escalation route.
- Given an unauthorised user views the session, then sensitive safeguarding details are hidden.
- Given a user records safeguarding risk, then identity and timestamp are recorded.
- Given a risk requires escalation, then the escalation route is shown.
- Given a concern is resolved, then resolver and resolution evidence are recorded.

### ROPS-AUTH-012: Audit events

Identity and permission-sensitive events must be auditable.

Events to log:

- account created
- sign-in succeeded
- sign-in failed
- logout
- role requested
- role approved
- role rejected
- permission changed
- PII revealed
- governed object edited
- study approved
- finding reviewed
- recommendation accepted
- safeguarding risk recorded
- safeguarding risk resolved

Acceptance criteria:

- Given an auditable event occurs, then event type, actor, target, timestamp and context are recorded.
- Given an event contains sensitive data, then unnecessary PII is not stored.
- Given an admin views audit events, then events are filterable by user, team, object and event type.
- Given a user lacks audit permission, then audit events are not visible.

## UI requirements

Required UI surfaces:

- Create an account
- Sign in
- Sign out confirmation
- Check your email
- Verify your email
- Choose or request your role
- Role pending approval
- Account settings
- Team settings
- Permission denied
- Session expired

Sign-up principles:

- Use “Create an account”.
- Keep account creation and sign-in separate.
- Ask for the minimum information.
- Explain why the role is needed.
- Explain whether a role requires approval.
- Avoid CAPTCHA where possible.
- Provide accessible recovery if abuse prevention blocks a user.
- Make timeout and email-code flows accessible.

Role-selection UI must show:

- role name
- plain-English description
- permissions summary
- approval requirement
- PII access status
- safeguarding access status
- reviewer or approver rights
- decision-owner rights

Permission-denied UI must:

- explain what the user cannot do
- explain what the user can still do
- show how to request access
- avoid technical error messages
- avoid leaking sensitive record details

## Cloudflare requirements

The Cloudflare layer should support:

- authentication through Cloudflare Access, OIDC or passwordless flows
- Worker-based identity validation
- D1 lookup for user, team and permissions
- server-side authorisation before Airtable access
- audit logging for identity and permission-sensitive events
- secrets stored as Cloudflare secrets
- optional Turnstile for public sign-up abuse protection
- optional Cloudflare Agent support for admin guidance or audit summaries

Cloudflare AI and Agents must not make final access-control decisions. They may support guided configuration, role explanation, audit summarisation or admin assistance. Deterministic Worker and D1 logic must enforce permissions.

## D1 requirements

D1 should be the application identity, role and audit store.

Suggested tables:

- `users`
- `identities`
- `teams`
- `team_memberships`
- `roles`
- `permissions`
- `role_permissions`
- `role_assignments`
- `sessions`
- `auth_events`
- `pii_access_events`
- `governance_events`
- `safeguarding_events`
- `airtable_identity_links`
- `invitations`
- `role_requests`

Key principles:

- D1 stores identity and permission truth.
- D1 stores stable internal user IDs.
- D1 stores role and permission assignments.
- D1 stores audit events.
- D1 avoids storing unnecessary PII in audit records.

## Airtable requirements

Airtable should remain the research data layer, not the primary authorisation system.

Airtable may later mirror:

- `Created by User ID`
- `Created by Display Name`
- `Last edited by User ID`
- `Approved by User ID`
- `Approved by Display Name`
- `Approved at`
- `Decision owner User ID`
- `Decision owner Display Name`
- `Governance status`
- `Safeguarding flag`
- `Safeguarding visibility`
- `PII access classification`

The Worker must check permission before Airtable reads and writes. Airtable must not be queried to make every role decision.

## Implementation methods

### Method 1: Cloudflare Access plus D1 RBAC

Summary: Cloudflare Access authenticates the user. D1 stores ResearchOps roles and permissions.

Strengths:

- Strong fit for internal beta.
- Uses existing Cloudflare stack.
- Supports enterprise identity providers.
- Avoids custom password storage.
- Keeps ResearchOps roles in D1.

Weaknesses:

- Less suitable for open public sign-up.
- Access and IdP logout semantics can be confusing.
- Requires Access JWT validation in Worker.
- Some account UI is outside ResearchOps control.

Best fit: internal government or departmental private beta.

### Method 2: External OIDC provider plus D1 RBAC

Summary: Use Entra ID, Google Workspace, Auth0, WorkOS, Keycloak, Clerk or similar for identity. D1 stores application roles.

Strengths:

- Strong enterprise IAM fit.
- Good MFA and lifecycle management.
- Supports federated login.
- Scales across organisations.
- Avoids custom password storage.

Weaknesses:

- Integration complexity.
- Provider cost and lock-in.
- Requires careful account linking.
- Callback and token handling must be robust.

Best fit: multi-organisation ResearchOps.

### Method 3: Passwordless email magic link plus D1 RBAC

Summary: ResearchOps sends time-limited email links or codes. D1 stores account and permissions.

Strengths:

- Simple for external collaborators.
- No password storage.
- Invitation-friendly.
- Works without enterprise IdP.

Weaknesses:

- Email account compromise risk.
- Requires secure email delivery.
- Needs replay protection and expiry.
- MFA is weaker unless separately added.

Best fit: invited external collaborators.

### Method 4: Passkeys or WebAuthn plus D1 RBAC

Summary: Users authenticate with passkeys. D1 stores roles and permissions.

Strengths:

- Strong phishing resistance.
- No password storage.
- Good long-term security direction.

Weaknesses:

- Higher implementation complexity.
- Recovery flows are harder.
- Device and browser support must be tested.
- Some users may need support.

Best fit: later high-security maturity phase.

### Method 5: Auth SaaS plus D1 RBAC

Summary: Use hosted auth such as Clerk, Auth0, WorkOS or Supabase Auth. D1 stores ResearchOps roles.

Strengths:

- Faster implementation.
- Hosted UI and MFA options.
- Strong public sign-up support.
- Reduces custom auth burden.

Weaknesses:

- Vendor dependency.
- Cost scaling.
- Data protection review needed.
- Risk of duplicated role truth.

Best fit: productised external-facing ResearchOps.

### Method 6: Custom username and password plus D1 RBAC

Summary: ResearchOps builds password authentication directly.

Strengths:

- Full control.
- No external auth provider dependency.

Weaknesses:

- Highest security burden.
- Password reset and MFA complexity.
- More attack surface.
- Slower delivery.
- Higher long-term maintenance cost.

Best fit: not recommended unless a hard constraint requires it.

### Method 7: Hybrid Access or OIDC plus passwordless collaborators

Summary: Staff use Cloudflare Access or OIDC. External collaborators use passwordless invitation. D1 unifies roles.

Strengths:

- Strong fit for mixed teams.
- Enterprise users get SSO.
- Collaborators do not need staff IAM.
- D1 remains the permission authority.
- Supports staged rollout.

Weaknesses:

- More complex UX.
- Two authentication routes to support.
- Account linking must be robust.
- Support model is more complex.

Best fit: recommended strategic direction for ResearchOps.

## Capability matrix

| Method | Account creation | MFA | Enterprise IAM | External users | Effort | Fit |
|---|---|---|---|---|---|---|
| Access + D1 | Invitation-led | Strong | Strong | Limited | Medium | Strong beta |
| OIDC + D1 | Provider-led | Strong | Strong | Medium | Medium-high | Strong scale |
| Passwordless + D1 | App-led | Medium | Weak | Strong | Medium | Good collaborator |
| Passkeys + D1 | App-led | Strong | Medium | Medium | High | Future strong |
| Auth SaaS + D1 | Mixed | Strong | Strong | Strong | Medium | Productised |
| Custom passwords | App-led | Build | Weak | Strong | High | Weak |
| Hybrid | Mixed | Strong | Strong | Strong | High | Best strategic |

## Recommended route

Recommended strategic route: hybrid Access or OIDC plus D1 RBAC, with passwordless invitation support for collaborators.

Recommended first implementation route:

- Cloudflare Access or external OIDC for authentication.
- D1 for users, identities, teams, roles, permissions and audit.
- Worker middleware for authorisation.
- Airtable access only after Worker authorisation.
- GOV.UK-style account, role and permission-denied interfaces.

Avoid custom username and password authentication as the first implementation route.

## Proposed route map

### Phase 0: Decision and threat model

- Confirm user groups.
- Confirm internal versus external access.
- Confirm role list.
- Confirm permission list.
- Confirm PII and safeguarding risk model.
- Confirm enterprise IAM need.

### Phase 1: Authentication foundation

- Account creation or invitation acceptance.
- Sign in.
- Sign out.
- D1 users.
- Identity links.
- Team membership.
- Basic auth audit.

### Phase 2: RBAC foundation

- Roles.
- Permissions.
- Role assignment.
- Role request and approval.
- Server-side permission middleware.

### Phase 3: P1 enablement

- PII redaction and reveal.
- Governed authorship.
- Reviewer and approver events.
- Decision ownership.
- Safeguarding visibility and escalation.

### Phase 4: Enterprise hardening

- IdP group mapping.
- MFA policy.
- Session policy.
- Step-up authentication.
- Audit dashboards.
- Support and recovery.

## Open questions

1. Is ResearchOps internal-only, or will it support external collaborators?
2. Should teams be invitation-only?
3. Which roles can assign roles?
4. Can a user hold different roles on different studies?
5. Does PII reveal require step-up authentication?
6. Who approves safeguarding access?
7. Should decision ownership be restricted to Product Owners?
8. Should Airtable mirror display names or only internal IDs?
9. Is enterprise SSO required for the first release?
10. Is passwordless access acceptable for collaborators?

## Non-implementation boundary

This document records requirements and architecture discussion only.

It does not:

- change application code
- change UI
- change data schema
- change Cloudflare configuration
- change D1 schema
- change Airtable tables
- create production routes
- create live authentication behaviour
