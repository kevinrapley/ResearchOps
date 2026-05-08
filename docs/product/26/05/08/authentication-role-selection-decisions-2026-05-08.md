# Authentication and role-selection decisions

**Date:** 2026-05-08  
**Status:** decision record  
**Related requirements:** [`authentication-role-selection-requirements-2026-05-08.md`](authentication-role-selection-requirements-2026-05-08.md)  
**Related reference notes:** [`authentication-role-selection-reference-notes-2026-05-08.md`](authentication-role-selection-reference-notes-2026-05-08.md)  
**Scope:** account creation, authentication, role selection, role boundaries, permissions, personal data reveal, safeguarding, audit, Cloudflare, D1, Airtable and implementation sequencing.  
**System-change boundary:** this record does not change application code, Cloudflare configuration, D1 schema, Airtable schema or live service behaviour.

## Purpose

This file records the 200 structured product decisions captured during the authentication and role-selection design conversation.

Questions 1 to 78 were answered directly. For questions 79 to 200, the user instructed that the recorded steer should be used as the answer.

## How to read this record

Each decision records the full question, the selected answer and the design implication.

The implications are written as implementation-facing design guidance. They are not implementation instructions by themselves. The next artefacts should turn this record into a product decision record, D1 schema proposal and implementation epic.

## Decisions

### Decision 001

**Question:** Which authentication architecture should ResearchOps take forward first?  
**Answer:** B. Use an external authentication route with D1-based ResearchOps role-based access control.  
**Design implication:** Authentication proves the user identity. D1 remains the application authority for ResearchOps roles, permissions, scope and audit.

### Decision 002

**Question:** Should account creation be invitation-only, open sign-up or hybrid?  
**Answer:** C. Use a hybrid model with invitation-led onboarding and controlled pending states where needed.  
**Design implication:** The design can support internal staff, collaborators and future open routes without granting privileged access by default.

### Decision 003

**Question:** What minimum account information should be captured during account creation?  
**Answer:** A. Capture only the minimum needed: email, display name and a route into a team or invitation.  
**Design implication:** The sign-up UI should be short and should avoid unnecessary personal data collection.

### Decision 004

**Question:** Should identity, team membership and role selection be treated as separate concepts?  
**Answer:** A. Yes. Keep identity, team membership and role selection separate.  
**Design implication:** The UI and D1 schema must not collapse sign-in, team access and permissions into one overloaded account record.

### Decision 005

**Question:** What access should a new user receive by default?  
**Answer:** B. Start new users with least privilege and no personal data, approval, audit or safeguarding access by default.  
**Design implication:** Default onboarding remains safe even when a user joins the wrong team or requests the wrong role.

### Decision 006

**Question:** What role scope should be implemented first?  
**Answer:** A. Enforce team-level roles first, but design the D1 schema with `scope_type` and `scope_id` so project and study roles can be added later.  
**Design implication:** The first release remains simple while avoiding a future schema dead end.

### Decision 007

**Question:** How should external collaborators be supported?  
**Answer:** C. Support collaborators through a controlled invitation route rather than unrestricted public registration.  
**Design implication:** The product can support mixed teams without weakening the core access model.

### Decision 008

**Question:** Where should ResearchOps store users, roles, permissions and audit truth?  
**Answer:** A. Use D1 as the identity, role, permission and audit control plane.  
**Design implication:** D1 becomes the canonical store for access decisions. Airtable does not decide permissions.

### Decision 009

**Question:** Should Airtable make authorisation decisions?  
**Answer:** C. No. Airtable may mirror selected governance metadata, but must not make access-control decisions.  
**Design implication:** The Worker must authorise requests before Airtable reads or writes happen.

### Decision 010

**Question:** Which roles or permissions should be treated as sensitive for approval?  
**Answer:** C. Sensitive access includes Approver, Safeguarding Lead, Team Admin, any role with personal data reveal permission and any role with audit view permission.  
**Design implication:** Role approval flows must treat elevated access as explicit and auditable.

### Decision 011

**Question:** Should personal data access be granted just because someone is on a team?  
**Answer:** C. No. Personal data access requires explicit permission.  
**Design implication:** Team membership alone should only support safe, pseudonymised access.

### Decision 012

**Question:** Should access checks depend on role names or permission codes?  
**Answer:** C. Use permission checks rather than hard-coded role-name checks.  
**Design implication:** Implementation should check capabilities such as `governed.approve` or `safeguarding.view`, not only role labels.

### Decision 013

**Question:** Should ordinary users see raw internal permission codes?  
**Answer:** B. No. Users should see plain-English permission descriptions.  
**Design implication:** The UI should describe tasks and sensitive access in human terms. Codes remain useful for APIs, tests and diagnostics.

### Decision 014

**Question:** Should account status and role status be stored separately?  
**Answer:** C. Yes. Account status and role status are separate.  
**Design implication:** An account can be active while a role request remains pending, rejected or expired.

### Decision 015

**Question:** Should role requests support visible lifecycle states?  
**Answer:** B. Yes. Role requests should show active, pending, rejected and expired states.  
**Design implication:** Users need clear recovery routes when access is not yet granted.

### Decision 016

**Question:** Should permission changes be auditable?  
**Answer:** B. Yes. Permission changes must be auditable.  
**Design implication:** The audit model must show who granted, changed or removed elevated access.

### Decision 017

**Question:** Should authentication events be logged?  
**Answer:** A. Yes. Account creation, sign-in, failed sign-in and logout are audit-relevant authentication events.  
**Design implication:** Authentication audit should be separate from application audit but linked by stable internal user ID.

### Decision 018

**Question:** Should failed sign-in messages reveal whether an email exists?  
**Answer:** A. No. Failed sign-in messages must not reveal whether an email exists.  
**Design implication:** Error messages should protect against account enumeration while still giving useful recovery steps.

### Decision 019

**Question:** Should logout explain the boundary between ResearchOps and single sign-on sessions?  
**Answer:** A. Yes. Logout should explain whether the wider identity-provider session may still exist.  
**Design implication:** Users need clear expectations when Cloudflare Access or enterprise single sign-on is involved.

### Decision 020

**Question:** Should timeout handling protect unsaved research work?  
**Answer:** A. Yes. Timeout handling must warn users and protect work where feasible.  
**Design implication:** Session expiry patterns must not silently lose notes or governed edits.

### Decision 021

**Question:** Should permission and system errors use plain English?  
**Answer:** A. Yes. Errors should be service-facing and written in plain English.  
**Design implication:** The UI should say what happened and what to do next, not expose raw D1, Worker or Airtable errors.

### Decision 022

**Question:** Should the UI have a current-user permissions endpoint?  
**Answer:** A. Yes. Provide a `/api/me/permissions` style route for UI state.  
**Design implication:** The UI can show relevant actions, but this must not replace server-side enforcement.

### Decision 023

**Question:** Should direct API attempts be blocked even when client controls are hidden?  
**Answer:** A. Yes. Server-side authorisation must block direct API attempts.  
**Design implication:** Every protected endpoint must enforce permissions in the Worker.

### Decision 024

**Question:** Should the Worker authorise before Airtable access?  
**Answer:** A. Yes. Worker authorisation must happen before any protected Airtable read or write.  
**Design implication:** Airtable data should not reach the browser until the Worker has applied policy.

### Decision 025

**Question:** Should the audit model use stable internal user IDs?  
**Answer:** A. Yes. Use stable internal user IDs in audit and governed metadata.  
**Design implication:** Provider subjects and emails can change. Audit needs a durable ResearchOps user identity.

### Decision 026

**Question:** Should Cloudflare Agents make access-control decisions?  
**Answer:** B. No. Agents may assist, but deterministic Worker and D1 logic must decide access.  
**Design implication:** Agents can explain, summarise or guide. They must not grant access or reveal restricted data.

### Decision 027

**Question:** Should public sign-up abuse prevention be designed in?  
**Answer:** A. Yes. Use server-verified abuse protection where public forms exist.  
**Design implication:** If Turnstile or similar protection is used, verification must happen server-side with accessible recovery.

### Decision 028

**Question:** How should secrets for identity and integrations be handled?  
**Answer:** C. Use Cloudflare secrets for sensitive identity, Turnstile and API values.  
**Design implication:** Secrets must not be committed or stored as plaintext configuration.

### Decision 029

**Question:** Should `participant.pii.view` and `participant.pii.reveal` be separate permissions?  
**Answer:** A. Yes. `participant.pii.view` and `participant.pii.reveal` are separate permissions.  
**Design implication:** Viewing a safe participant record is different from actively revealing identifiable information.

### Decision 030

**Question:** Should revealing personal data require the user to enter a reason?  
**Answer:** C. Personal data reveal is logged, but no reason is required.  
**Design implication:** Audit captures access without adding friction during legitimate research tasks.

### Decision 031

**Question:** Should personal data reveal be time-limited after activation?  
**Answer:** A. Yes. Revealed personal data is time-limited after activation.  
**Design implication:** Personal data should return to hidden state without relying on the user to remember to hide it.

### Decision 032

**Question:** How long should standard revealed personal data remain visible before auto-hiding?  
**Answer:** B. Standard revealed personal data remains visible for 5 minutes.  
**Design implication:** Standard personal data supports practical contact checks while limiting exposure.

### Decision 033

**Question:** How long should highly sensitive revealed personal data remain visible before auto-hiding?  
**Answer:** B. Highly sensitive revealed personal data remains visible for 1 minute.  
**Design implication:** Highly sensitive material receives a shorter exposure window.

### Decision 034

**Question:** Should revealing highly sensitive personal data require an extra identity check?  
**Answer:** C. Not in the first release, but design permissions and audit so step-up authentication can be added later.  
**Design implication:** The first slice avoids extra friction while leaving schema room for future higher-risk controls.

### Decision 035

**Question:** Should participant personal data export be controlled separately from personal data reveal?  
**Answer:** C. No personal data export in the first release, but design for future `participant.pii.export`.  
**Design implication:** Export is higher risk than on-screen reveal and must not be hidden inside reveal permission.

### Decision 036

**Question:** Should personal data reveal events be visible to users in their own account activity?  
**Answer:** A. Users see their own personal data reveal events. Admins with `audit.view` see team-wide events.  
**Design implication:** The product supports personal transparency and team audit without widening access.

### Decision 037

**Question:** Should users see the participant identifier in their own personal data reveal activity?  
**Answer:** A. Show pseudonym or participant ID only.  
**Design implication:** Account activity remains useful without repeating identifiable data.

### Decision 038

**Question:** Should admins with `audit.view` see identifiable participant names in personal data reveal logs?  
**Answer:** B. Only where they also have `participant.pii.reveal`.  
**Design implication:** General audit access must not become a back door to participant identity.

### Decision 039

**Question:** Should personal data reveal audit entries record what was revealed?  
**Answer:** A. Record field group only, not exact field values.  
**Design implication:** Audit has useful context without duplicating sensitive data.

### Decision 040

**Question:** Should personal data reveal audit entries be immutable?  
**Answer:** B. They cannot be edited, but may be redacted by a platform owner through a controlled process.  
**Design implication:** Normal users cannot alter audit history, but accidental sensitive content has a controlled remediation route.

### Decision 041

**Question:** Should controlled redaction of audit entries require a second approval?  
**Answer:** A. Yes. Platform owner plus second platform owner approval.  
**Design implication:** Audit redaction is itself a high-trust action.

### Decision 042

**Question:** Should failed attempts to reveal personal data be audited?  
**Answer:** A. Yes. Audit all failed personal data reveal attempts.  
**Design implication:** Failed attempts may indicate misuse, misconfiguration or unclear permissions.

### Decision 043

**Question:** Should failed personal data reveal attempts trigger an alert?  
**Answer:** B. Only repeated failed attempts trigger an alert.  
**Design implication:** The design avoids alert fatigue while surfacing suspicious patterns.

### Decision 044

**Question:** Who should receive alerts for repeated failed personal data reveal attempts?  
**Answer:** B. Team Admins with `audit.view`; Safeguarding Lead as well for safeguarding-related groups.  
**Design implication:** Alerts route to roles that can act on the concern.

### Decision 045

**Question:** Should repeated failed personal data reveal alerts send email notifications?  
**Answer:** C. Product alerts for all repeated failures; email only for safeguarding-related failures.  
**Design implication:** Email is reserved for higher-risk operational concerns.

### Decision 046

**Question:** Who can reveal personal data during a live research session?  
**Answer:** B. Session owner and assigned researchers with `participant.pii.reveal`.  
**Design implication:** Live-session personal data reveal depends on both session assignment and permission.

### Decision 047

**Question:** Should observers ever be able to reveal participant personal data during live sessions?  
**Answer:** A. No. Observers cannot reveal personal data during live sessions.  
**Design implication:** Observer mode remains a non-personal-data role.

### Decision 048

**Question:** Should observers see that restricted personal data exists during live sessions?  
**Answer:** A. No. Observers see only the pseudonymised participant view.  
**Design implication:** The UI should not expose the existence of restricted details to observers.

### Decision 049

**Question:** Should assigned note-takers be treated like assigned researchers for personal data reveal?  
**Answer:** B. No. Note-takers cannot reveal personal data during live sessions.  
**Design implication:** Note-taking does not imply identifiable-data access.

### Decision 050

**Question:** Should note-takers see restricted safeguarding flags during live sessions?  
**Answer:** B. They can see that a safeguarding flag exists, but not the detail.  
**Design implication:** Note-takers get enough signal to avoid unsafe notes without seeing restricted content.

### Decision 051

**Question:** Should note-takers be able to record safeguarding observations during live sessions?  
**Answer:** B. Yes, but the observation must be reviewed by a Safeguarding Lead or assigned researcher.  
**Design implication:** Note-takers can raise concerns but cannot resolve, classify or own safeguarding decisions.

### Decision 052

**Question:** Should note-taker safeguarding observations trigger immediate notification?  
**Answer:** B. Notify assigned researchers immediately; notify Safeguarding Lead only if urgent.  
**Design implication:** The signal reaches the session team without escalating every observation.

### Decision 053

**Question:** Should note-takers be able to mark a safeguarding observation as urgent?  
**Answer:** A. Yes, but they cannot resolve or classify the concern.  
**Design implication:** Urgency is a signal, not a safeguarding decision.

### Decision 054

**Question:** Should note-takers choose a reason when marking a safeguarding observation as urgent?  
**Answer:** A. Yes. They must choose a reason from a short list.  
**Design implication:** Structured reasons support triage without encouraging excessive sensitive free text.

### Decision 055

**Question:** Should note-takers add free-text notes to urgent safeguarding observations?  
**Answer:** B. Yes, but only after choosing a structured reason.  
**Design implication:** Free text is secondary and should be constrained by guidance.

### Decision 056

**Question:** Who can see free-text urgent safeguarding notes from note-takers?  
**Answer:** D. Only assigned researchers with `safeguarding.view`; if the reason is researcher safety concern or session pause/stop, alert the Safeguarding Lead in-product and by email.  
**Design implication:** Content remains restricted while immediate operational safety signals are routed to safeguarding leadership.

### Decision 057

**Question:** Should Safeguarding Leads see the full free-text note when they receive urgent alerts?  
**Answer:** B. Yes in the product, but email includes only a minimal notification and link.  
**Design implication:** Email acts as a prompt, not a secondary sensitive-data store.

### Decision 058

**Question:** Should urgent safeguarding alert emails include participant context?  
**Answer:** B. Include participant pseudonym and session ID.  
**Design implication:** The email gives enough triage context without exposing participant identity.

### Decision 059

**Question:** Should urgent safeguarding alert emails be sent immediately or batched?  
**Answer:** A. Send immediately.  
**Design implication:** Urgent safeguarding alerts are escalation signals, not digest items.

### Decision 060

**Question:** Should the product require acknowledgement that the Safeguarding Lead received an urgent alert?  
**Answer:** A. Yes. Require acknowledgement in the product.  
**Design implication:** Acknowledgement becomes auditable and visible inside the controlled product environment.

### Decision 061

**Question:** How should urgent safeguarding acknowledgement work?  
**Answer:** A. Product acknowledgement only.  
**Design implication:** Acknowledgement stays inside the product and can be audited reliably.

### Decision 062

**Question:** Who can acknowledge an urgent safeguarding alert?  
**Answer:** B. Safeguarding Lead or delegate.  
**Design implication:** Delegation supports absence cover without opening acknowledgement to all researchers.

### Decision 063

**Question:** Should acknowledgement include a status?  
**Answer:** C. Use acknowledged, reviewing and escalated.  
**Design implication:** Status supports operational handover and visible progress.

### Decision 064

**Question:** Should acknowledgement require a comment?  
**Answer:** C. Require a comment only when escalated.  
**Design implication:** Comments are required for higher-risk action without overburdening routine acknowledgement.

### Decision 065

**Question:** What happens if no one acknowledges an urgent alert?  
**Answer:** A. Escalate after 15 minutes.  
**Design implication:** Urgent means time-sensitive and needs a missed-acknowledgement path.

### Decision 066

**Question:** Who receives missed-acknowledgement escalation?  
**Answer:** B. Second Safeguarding Lead.  
**Design implication:** Escalation stays within the safeguarding role family.

### Decision 067

**Question:** Should urgent safeguarding alerts have severity levels?  
**Answer:** B. Use urgent and critical.  
**Design implication:** The first release has enough distinction without a complex severity taxonomy.

### Decision 068

**Question:** Who can classify severity?  
**Answer:** A. Safeguarding Lead only.  
**Design implication:** Severity classification is a safeguarding decision.

### Decision 069

**Question:** Should note-takers see alert acknowledgement status?  
**Answer:** A. Yes, status only.  
**Design implication:** Note-takers know action is happening without seeing restricted detail.

### Decision 070

**Question:** Should assigned researchers see acknowledgement detail?  
**Answer:** A. Yes, if they have `safeguarding.view`.  
**Design implication:** Acknowledgement detail remains permission-gated.

### Decision 071

**Question:** Should acknowledgement events be immutable?  
**Answer:** C. Redactable by platform owner.  
**Design implication:** The same controlled-redaction principle applies to safeguarding acknowledgement events.

### Decision 072

**Question:** Should safeguarding alert notifications be stored in D1?  
**Answer:** A. Yes. D1 is canonical.  
**Design implication:** D1 remains the authority for alert state, notification and audit.

### Decision 073

**Question:** Should Airtable mirror safeguarding alert status?  
**Answer:** A. Yes, minimal status only.  
**Design implication:** Airtable can support operations without duplicating sensitive detail.

### Decision 074

**Question:** Should safeguarding free-text notes be stored in Airtable?  
**Answer:** B. No. Store in D1 only.  
**Design implication:** Restricted safeguarding content should not be spread into Airtable.

### Decision 075

**Question:** Should safeguarding notes be encrypted separately?  
**Answer:** C. Not in the first release.  
**Design implication:** The design should leave room for field-level encryption later.

### Decision 076

**Question:** Should safeguarding notes have retention rules?  
**Answer:** A. Yes, team-configured retention.  
**Design implication:** Retention may vary by team, organisation or study context.

### Decision 077

**Question:** Who can configure safeguarding retention?  
**Answer:** D. Team Admin plus Safeguarding Lead.  
**Design implication:** Retention is both operational governance and safeguarding governance.

### Decision 078

**Question:** Should exports include safeguarding data?  
**Answer:** C. Not in the first release, but design `safeguarding.export`.  
**Design implication:** Export is high risk and must be separately permissioned later.

### Decision 079

**Question:** Should safeguarding audit be separate from general audit?  
**Answer:** C. Use the same canonical log with restricted filtered views.  
**Design implication:** The platform avoids duplicate audit truth while still limiting safeguarding audit visibility.

### Decision 080

**Question:** Should `audit.view` include safeguarding audit?  
**Answer:** B. No. It needs `safeguarding.audit.view`.  
**Design implication:** General audit access must not unlock safeguarding detail.

### Decision 081

**Question:** Should permission names include a separate safeguarding audit permission?  
**Answer:** A. Yes. Add `safeguarding.audit.view`.  
**Design implication:** The permission model avoids ambiguity between general and safeguarding audit.

### Decision 082

**Question:** Should role assignment require approval?  
**Answer:** A. Sensitive roles only.  
**Design implication:** Low-risk onboarding remains lightweight while elevated access is controlled.

### Decision 083

**Question:** Which roles are sensitive?  
**Answer:** B. Approver, Safeguarding Lead, Team Admin, plus personal data reveal and audit roles.  
**Design implication:** Sensitive means elevated trust or access to restricted information.

### Decision 084

**Question:** Who approves sensitive roles?  
**Answer:** B. Team Admin plus role-specific owner.  
**Design implication:** High-risk roles require operational and domain review.

### Decision 085

**Question:** Should Team Admins grant themselves sensitive roles?  
**Answer:** C. Only with second approval.  
**Design implication:** The design prevents quiet privilege escalation.

### Decision 086

**Question:** Should role assignments expire?  
**Answer:** B. Sensitive roles only.  
**Design implication:** Elevated access gets periodic review without burdening every user.

### Decision 087

**Question:** Default expiry for sensitive roles?  
**Answer:** C. 180 days.  
**Design implication:** Six months is proportionate for elevated-access review.

### Decision 088

**Question:** Should users receive expiry warnings?  
**Answer:** A. Yes, 14 days before expiry.  
**Design implication:** Users and admins get enough time to renew or adjust access.

### Decision 089

**Question:** Should expired access immediately block actions?  
**Answer:** A. Yes.  
**Design implication:** Expiry must have enforcement meaning.

### Decision 090

**Question:** Should pending role requests allow temporary access?  
**Answer:** B. Yes, low-risk access only.  
**Design implication:** Users can continue safe work while waiting for approval.

### Decision 091

**Question:** Should denied role requests be audited?  
**Answer:** A. Yes.  
**Design implication:** Denied access is part of governance history.

### Decision 092

**Question:** Should denied users see who denied the request?  
**Answer:** B. No.  
**Design implication:** Show the outcome and recovery route without exposing individual approvers.

### Decision 093

**Question:** Should role requests require a reason?  
**Answer:** A. Sensitive roles only.  
**Design implication:** Keep low-risk requests simple while documenting elevated-access need.

### Decision 094

**Question:** Should permission changes require a reason?  
**Answer:** B. Sensitive permissions only.  
**Design implication:** Audit quality is balanced against admin burden.

### Decision 095

**Question:** Should permissions be assigned directly to users?  
**Answer:** B. Yes, exceptions allowed.  
**Design implication:** Roles remain primary. Direct exceptions must be explicit and audited.

### Decision 096

**Question:** Should direct permission exceptions expire?  
**Answer:** A. Yes, always.  
**Design implication:** Exceptions are riskier than role membership and need expiry.

### Decision 097

**Question:** Should D1 support `scope_type` and `scope_id`?  
**Answer:** A. Yes, from the first schema.  
**Design implication:** The schema can support team, project and study scope later.

### Decision 098

**Question:** First supported role scope?  
**Answer:** A. Team only.  
**Design implication:** Schema supports future scope, but first enforcement stays simpler.

### Decision 099

**Question:** Should UI expose project and study roles in first release?  
**Answer:** A. No.  
**Design implication:** Avoid UI complexity until enforcement is mature.

### Decision 100

**Question:** Should `/api/me/permissions` return raw permission codes?  
**Answer:** C. Return codes and labels.  
**Design implication:** The UI needs labels and tests need codes.

### Decision 101

**Question:** Should permission-denied responses reveal missing permission codes?  
**Answer:** C. Admin-only diagnostics.  
**Design implication:** Support users can debug without leaking implementation detail to normal users.

### Decision 102

**Question:** Should permission-denied pages include access request links?  
**Answer:** A. Yes.  
**Design implication:** Users get a clear recovery path.

### Decision 103

**Question:** Should access requests be routed by permission?  
**Answer:** A. Yes.  
**Design implication:** Requests go to the person or role that can make the decision.

### Decision 104

**Question:** Should access requests notify by email?  
**Answer:** C. Email for sensitive requests only.  
**Design implication:** Routine access stays in-product; high-risk access gets attention.

### Decision 105

**Question:** Should Team Admins see all role requests?  
**Answer:** A. Yes.  
**Design implication:** Team Admins need operational oversight.

### Decision 106

**Question:** Should Safeguarding Leads see safeguarding role requests?  
**Answer:** A. Yes.  
**Design implication:** They need to approve or advise on safeguarding access.

### Decision 107

**Question:** Should Approvers approve other Approvers?  
**Answer:** C. Only with Team Admin.  
**Design implication:** Avoid closed approval loops.

### Decision 108

**Question:** Should account creation be invitation-first?  
**Answer:** C. Hybrid.  
**Design implication:** Staff and collaborators may need different routes.

### Decision 109

**Question:** First-release account route?  
**Answer:** C. Access or OIDC plus invitation model.  
**Design implication:** This fits mixed teams and avoids custom password burden.

### Decision 110

**Question:** Should password authentication be built?  
**Answer:** C. Later only if required.  
**Design implication:** Custom passwords are deferred.

### Decision 111

**Question:** Should collaborator access use magic links?  
**Answer:** C. Later only.  
**Design implication:** Design for collaborators without blocking staff authentication.

### Decision 112

**Question:** Should MFA be required?  
**Answer:** C. Identity provider policy decides.  
**Design implication:** Enterprise identity management owns MFA initially.

### Decision 113

**Question:** Should MFA status be stored in D1?  
**Answer:** C. Store provider claim only.  
**Design implication:** Avoid duplicating identity-provider truth.

### Decision 114

**Question:** Should step-up authentication be modelled in schema?  
**Answer:** A. Yes.  
**Design implication:** Future high-risk checks can be added without schema redesign.

### Decision 115

**Question:** Should step-up be implemented in first release?  
**Answer:** B. No.  
**Design implication:** Model it, but defer the build.

### Decision 116

**Question:** Should sessions auto-expire?  
**Answer:** A. Yes.  
**Design implication:** Session policy supports risk control.

### Decision 117

**Question:** Session warning timing?  
**Answer:** B. 5 minutes before expiry.  
**Design implication:** Users get enough time to act.

### Decision 118

**Question:** Should long research notes autosave?  
**Answer:** A. Yes.  
**Design implication:** Prevent session-timeout data loss.

### Decision 119

**Question:** Should autosaved drafts be encrypted?  
**Answer:** B. Not first release.  
**Design implication:** Design carefully, but do not block the authentication foundation.

### Decision 120

**Question:** Should audit logs include IP address?  
**Answer:** C. Hash or partial only.  
**Design implication:** Keep useful security signal with lower privacy exposure.

### Decision 121

**Question:** Should audit logs include user agent?  
**Answer:** C. Browser family only.  
**Design implication:** Enough for anomaly review without excessive fingerprinting.

### Decision 122

**Question:** Should audit events include route or page?  
**Answer:** A. Yes.  
**Design implication:** Route context helps explain what happened.

### Decision 123

**Question:** Should audit events include request ID?  
**Answer:** A. Yes.  
**Design implication:** Request IDs support traceability.

### Decision 124

**Question:** Should every protected API call be audited?  
**Answer:** C. Sensitive actions only.  
**Design implication:** Full audit would be noisy and costly.

### Decision 125

**Question:** Should denied API calls be audited?  
**Answer:** B. Sensitive denied calls only.  
**Design implication:** Denials are audited where risk is meaningful.

### Decision 126

**Question:** Should audit logs be visible in UI first release?  
**Answer:** A. Yes, limited view.  
**Design implication:** The first release should expose account activity and basic team audit.

### Decision 127

**Question:** Should users see their own account activity?  
**Answer:** A. Yes.  
**Design implication:** Transparency supports trust and misuse detection.

### Decision 128

**Question:** Should account activity include failed sign-ins?  
**Answer:** A. Yes.  
**Design implication:** Users can spot suspicious access attempts.

### Decision 129

**Question:** Should account activity show precise location?  
**Answer:** C. Country only.  
**Design implication:** Avoid false precision and unnecessary location detail.

### Decision 130

**Question:** Should users download their account activity?  
**Answer:** C. Later.  
**Design implication:** Useful, but not core to the first release.

### Decision 131

**Question:** Should admin audit export exist?  
**Answer:** C. Later with `audit.export`.  
**Design implication:** Audit export is high risk and needs separate permission.

### Decision 132

**Question:** Should D1 schema include `audit.export` now?  
**Answer:** A. Yes.  
**Design implication:** Reserve the permission even if unused.

### Decision 133

**Question:** Should participant personal data field groups be configurable?  
**Answer:** B. No, fixed groups in first release.  
**Design implication:** Fixed groups reduce ambiguity.

### Decision 134

**Question:** Should highly sensitive personal data groups be configurable?  
**Answer:** B. No, fixed list.  
**Design implication:** Sensitive classification is governed centrally.

### Decision 135

**Question:** Should personal data reveal warnings differ by group?  
**Answer:** A. Yes.  
**Design implication:** Risk is visible in context.

### Decision 136

**Question:** Should standard personal data reveal timeout stay at 5 minutes?  
**Answer:** A. Yes.  
**Design implication:** This preserves the corrected timeout decision.

### Decision 137

**Question:** Should highly sensitive personal data reveal timeout stay at 1 minute?  
**Answer:** A. Yes.  
**Design implication:** This preserves the higher-sensitivity timeout decision.

### Decision 138

**Question:** Should reveal state persist on refresh?  
**Answer:** B. No.  
**Design implication:** Refresh resets to hidden.

### Decision 139

**Question:** Should reveal state persist across browser tabs?  
**Answer:** B. No.  
**Design implication:** Each tab starts hidden.

### Decision 140

**Question:** Should reveal action require visible user intent?  
**Answer:** A. Yes.  
**Design implication:** Personal data reveal should never be accidental.

### Decision 141

**Question:** Should reveal controls use confirmation dialog?  
**Answer:** A. Yes, highly sensitive only.  
**Design implication:** This controls higher risk without adding too much friction for routine checks.

### Decision 142

**Question:** Should personal data reveal reason remain optional?  
**Answer:** A. Yes.  
**Design implication:** This preserves the earlier no-reason-required decision.

### Decision 143

**Question:** Should personal data reveal events alert users?  
**Answer:** B. Own account activity only.  
**Design implication:** Visible without creating notification noise.

### Decision 144

**Question:** Should participant-level access history be visible?  
**Answer:** A. Yes, to authorised users.  
**Design implication:** Participant records can show accountability context.

### Decision 145

**Question:** Should participant access history show actor names?  
**Answer:** C. Only to users with `audit.view`.  
**Design implication:** Actor identity is itself controlled audit information.

### Decision 146

**Question:** Should governed edits require change summaries?  
**Answer:** B. Sensitive objects only.  
**Design implication:** Decision-bearing artefacts get stronger traceability.

### Decision 147

**Question:** Which governed objects need change summaries?  
**Answer:** A. Study approval, findings and recommendations.  
**Design implication:** Start with artefacts that carry decisions.

### Decision 148

**Question:** Should recommendations require decision owner?  
**Answer:** C. Accepted recommendations only.  
**Design implication:** Accountability attaches when a recommendation is accepted.

### Decision 149

**Question:** Should decision owner be a user only?  
**Answer:** A. User only.  
**Design implication:** Accountability needs a named person.

### Decision 150

**Question:** Should decision ownership be transferable?  
**Answer:** A. Yes.  
**Design implication:** Ownership can change while previous owner remains auditable.

### Decision 151

**Question:** Who can transfer decision ownership?  
**Answer:** C. Current owner or Team Admin.  
**Design implication:** Practical control with audit.

### Decision 152

**Question:** Should study approval be reversible?  
**Answer:** C. Superseded only.  
**Design implication:** Do not erase approval history.

### Decision 153

**Question:** Should approval require two approvers?  
**Answer:** B. High-risk studies only.  
**Design implication:** Governance is proportionate to risk.

### Decision 154

**Question:** Who defines high-risk study?  
**Answer:** C. Study risk checklist.  
**Design implication:** Structured criteria prevent subjective drift.

### Decision 155

**Question:** Should high-risk classification be auditable?  
**Answer:** A. Yes.  
**Design implication:** Risk level drives controls and must be traceable.

### Decision 156

**Question:** Should accessibility needs be treated as highly sensitive personal data?  
**Answer:** A. Yes.  
**Design implication:** This is a safer default for the first release.

### Decision 157

**Question:** Should contact details be standard personal data?  
**Answer:** A. Yes.  
**Design implication:** Contact details require reveal but are not classified as highly sensitive by default.

### Decision 158

**Question:** Should safeguarding flags be visible outside sessions?  
**Answer:** A. Yes, authorised users only.  
**Design implication:** Safeguarding is not limited to live-session context.

### Decision 159

**Question:** Should safeguarding flag existence be visible to unauthorised users?  
**Answer:** A. No.  
**Design implication:** Avoid exposing sensitive existence unnecessarily.

### Decision 160

**Question:** Should first implementation include Cloudflare Agent support?  
**Answer:** C. Admin guidance only.  
**Design implication:** Agents can explain, but must not decide access.

### Decision 161

**Question:** Should Agents summarise audit logs?  
**Answer:** C. Later only.  
**Design implication:** Agent audit summary is useful later, but not needed for the authentication foundation.

### Decision 162

**Question:** Should Agents recommend role assignments?  
**Answer:** C. Suggest only, no action.  
**Design implication:** Human approval remains required.

### Decision 163

**Question:** Should Agents process safeguarding content?  
**Answer:** C. Later, with explicit controls.  
**Design implication:** Treat agent processing of safeguarding content as high-risk future work.

### Decision 164

**Question:** Should there be a public registration page?  
**Answer:** C. Later.  
**Design implication:** Invitation-first remains safer until the product is more mature.

### Decision 165

**Question:** Should unauthenticated users access any ResearchOps pages?  
**Answer:** A. Marketing and information pages only.  
**Design implication:** Product data remains protected.

### Decision 166

**Question:** Should the home page change when signed in?  
**Answer:** A. Yes.  
**Design implication:** Signed-in users need team and project context.

### Decision 167

**Question:** Should users choose active team after sign-in?  
**Answer:** A. Yes, if they belong to multiple teams.  
**Design implication:** Avoid unnecessary steps for single-team users.

### Decision 168

**Question:** Should active team be visible in the header?  
**Answer:** A. Yes.  
**Design implication:** This reduces wrong-team actions.

### Decision 169

**Question:** Should team switching require confirmation?  
**Answer:** A. Yes, if unsaved work exists.  
**Design implication:** Confirmation is used only where risk exists.

### Decision 170

**Question:** Should team switching be audited?  
**Answer:** B. No.  
**Design implication:** Team switching is usually too noisy for audit.

### Decision 171

**Question:** Should team membership removal take effect immediately?  
**Answer:** A. Yes.  
**Design implication:** The next protected request must enforce removal.

### Decision 172

**Question:** Should removed users keep access to exported files?  
**Answer:** C. Warn admins before removal.  
**Design implication:** The product cannot claw back external files, but it can warn admins about that limitation.

### Decision 173

**Question:** Should role changes invalidate active sessions?  
**Answer:** C. Sensitive permission loss only.  
**Design implication:** Permissions are recomputed on protected requests, with stronger handling for sensitive loss.

### Decision 174

**Question:** Should `/api/me` cache permissions?  
**Answer:** C. Short cache only.  
**Design implication:** UI can be efficient while server-side enforcement remains live.

### Decision 175

**Question:** Should client-side hidden controls be tested?  
**Answer:** A. Yes.  
**Design implication:** Hidden controls support usability and must match permission state.

### Decision 176

**Question:** Should direct API denial tests be mandatory?  
**Answer:** A. Yes.  
**Design implication:** Server-side authorisation is core security acceptance.

### Decision 177

**Question:** Should route permission mapping be documented?  
**Answer:** A. Yes.  
**Design implication:** Traceability and tests need route-to-permission mapping.

### Decision 178

**Question:** Should every protected route declare permissions?  
**Answer:** A. Yes.  
**Design implication:** There should be no implicit protected routes.

### Decision 179

**Question:** Should missing route permission fail closed?  
**Answer:** A. Yes.  
**Design implication:** The system must be secure by default.

### Decision 180

**Question:** Should CI test route permission coverage?  
**Answer:** A. Yes.  
**Design implication:** CI should prevent authorisation regressions.

### Decision 181

**Question:** Should seed roles and permissions be versioned?  
**Answer:** A. Yes.  
**Design implication:** Permission drift is controlled.

### Decision 182

**Question:** Should permission migrations be reversible?  
**Answer:** C. Where safe.  
**Design implication:** Some audit migrations should not reverse destructively.

### Decision 183

**Question:** Should authentication decisions produce trace documents?  
**Answer:** C. Major decisions only.  
**Design implication:** Avoid excessive documentation while preserving major rationale.

### Decision 184

**Question:** Should implementation start with a documentation-only PR?  
**Answer:** C. Docs plus schema only.  
**Design implication:** A D1 schema proposal is the next concrete artefact.

### Decision 185

**Question:** Should the first build PR include UI screens?  
**Answer:** C. Skeleton only.  
**Design implication:** Build routes and states before full UI polish.

### Decision 186

**Question:** Should the first build PR include real auth provider integration?  
**Answer:** B. No. Mock identity first.  
**Design implication:** Mock identity enables role-based access control development safely.

### Decision 187

**Question:** Should mock identity be production-disabled?  
**Answer:** A. Yes.  
**Design implication:** CI should prove mock identity cannot run in production.

### Decision 188

**Question:** Should the first build include D1 migrations?  
**Answer:** A. Yes.  
**Design implication:** Make the control plane real early.

### Decision 189

**Question:** Should Airtable changes be included first?  
**Answer:** B. No.  
**Design implication:** Authorisation foundation should land before Airtable mirrors.

### Decision 190

**Question:** Should the first slice include personal data reveal UI?  
**Answer:** B. No.  
**Design implication:** Build identity and permissions first.

### Decision 191

**Question:** Should the first slice include safeguarding alert UI?  
**Answer:** C. Prototype only.  
**Design implication:** Validate complexity before production behaviour.

### Decision 192

**Question:** Should the first slice include audit UI?  
**Answer:** C. Account activity only.  
**Design implication:** Start narrow.

### Decision 193

**Question:** Should the first slice include role management UI?  
**Answer:** A. Yes, basic Team Admin UI.  
**Design implication:** There must be a way to assign roles.

### Decision 194

**Question:** Should role assignment be possible by API?  
**Answer:** C. Admin only.  
**Design implication:** Role assignment API needs strict permission and audit.

### Decision 195

**Question:** Should role assignment have tests?  
**Answer:** A. Yes.  
**Design implication:** Role assignment is security-critical.

### Decision 196

**Question:** Should release require manual security review?  
**Answer:** A. Yes.  
**Design implication:** Authentication and role-based access control are high-trust capabilities.

### Decision 197

**Question:** Should release require accessibility review?  
**Answer:** A. Yes.  
**Design implication:** Account and permission journeys carry high-friction risks.

### Decision 198

**Question:** Should release require threat model update?  
**Answer:** A. Yes.  
**Design implication:** Authentication changes the threat surface.

### Decision 199

**Question:** Should release require data protection review?  
**Answer:** C. Before personal data reveal goes live.  
**Design implication:** Personal data activation needs formal protection review.

### Decision 200

**Question:** What should be the next repository artefact?  
**Answer:** D. Product decision record, D1 schema proposal and implementation epic.  
**Design implication:** Decisions, schema and delivery plan should move together.

## Cross-cutting design consequences

### Identity and access model

ResearchOps should use external authentication for identity and D1 for ResearchOps-specific roles, permissions, scopes and audit. Identity, team membership and role assignment remain separate concepts.

The first enforced role scope is team-level. The D1 schema should still include `scope_type` and `scope_id` so project-level and study-level roles can be added later without redesign.

### Authorisation boundary

The Worker is the policy enforcement point. It must validate identity, load D1 permissions, enforce route permissions and authorise every protected Airtable operation before data leaves the server.

Airtable remains the research data layer. It may mirror selected operational status, but it must not become the primary authorisation engine.

### Participant data

Pseudonymised participant views are the default. Personal data reveal is explicit, permission-gated, time-limited and auditable.

Standard personal data remains visible for 5 minutes. Highly sensitive personal data remains visible for 1 minute. Refreshes and new tabs reset reveal state to hidden.

Participant personal data export is out of scope for the first release. The permission model should still reserve `participant.pii.export`.

### Safeguarding

Safeguarding details, safeguarding audit and safeguarding notes need their own restricted permission model. General `audit.view` does not unlock safeguarding audit.

Urgent safeguarding alerts are sent immediately. Email contains minimal context only: participant pseudonym, session ID, structured urgency reason and link. Full free-text content stays in the product.

Acknowledgement happens in the product. Missed acknowledgement escalates after 15 minutes to a second Safeguarding Lead.

### Audit

Audit should capture sensitive actions, sensitive denials, authentication events, personal data reveal events, governance changes and safeguarding actions. It should avoid unnecessary personal data.

Audit should include route or page, request ID and controlled actor references. IP address should be hashed or partial. User agent should be stored as browser family only.

Audit export is not in the first release. The schema should reserve `audit.export`.

### UI

The UI should provide plain-English role descriptions, permission-denied pages, access request routes, account activity, team context, active team display and basic Team Admin role management.

Permission codes are useful for diagnostics and tests. They should not be exposed to ordinary users unless needed for admin diagnostics.

### Cloudflare and Agents

Cloudflare Access or OIDC plus invitation-led onboarding is the first implementation direction. MFA is controlled by the identity provider.

Cloudflare Agents may support admin guidance, future summaries or suggestions. They must not make access-control decisions, grant roles, reveal restricted data or approve governed artefacts.

### Implementation sequencing

The next implementation artefacts should be a product decision record, D1 schema proposal and implementation epic.

The first build should use mock identity, D1 migrations, route permission mapping, server-side denial tests, basic account activity and basic Team Admin role management. It should not include Airtable schema changes, personal data reveal UI or production safeguarding alert behaviour.
