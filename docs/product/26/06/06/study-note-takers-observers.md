# Study note takers and observers

Date: 2026-06-06
Status: production implementation branch
Route: `/pages/study/note-takers-observers/`

## Purpose

The page lets a researcher confirm whether anyone beyond the lead researcher will join study sessions, and record the operational details needed to manage those people before fieldwork starts.

It exists because note takers, observers, facilitators and accessibility support can affect planning, participant consent and the session experience. The page keeps that setup visible as a study task without making researchers record unnecessary personal data.

## Decision history

This page started from a study setup task that already existed on `/pages/study/` as “Add note takers and observers”, but the task was marked “Not available yet”. The initial product direction was to turn that task into a real study-scoped route where researchers could record who would support sessions, what role each person had, and whether observer access had been considered before fieldwork.

The important learning is that the page is not just an address book. It is a setup decision point. The design changed as the team challenged the initial assumptions, reviewed the prototype, and then tested the live authenticated journey.

### Initial team position

Product initially framed the user need as: “As a researcher, I need to set up who is supporting or observing a study session, so the session can be run safely, roles are clear, and observers do not accidentally compromise consent, inclusion or note quality.”

ResearchOps agreed the page must distinguish note takers from observers. Note takers actively help capture evidence. Observers attend but should normally not interrupt or influence the session. The page also needed to account for people who join only some sessions.

User research said the page should help researchers answer four practical questions before fieldwork:

- who is joining
- why they are joining
- what they are allowed to do
- whether participants have been told observers may attend

Interaction design initially treated the page as another study setup route, reached from the study task list with breadcrumbs only and no “Back to study” button.

Content design supported “Add note takers and observers” as a task label, with “Note takers and observers” as the page title and plainer body copy about people who help run, observe or take notes during sessions.

Accessibility and privacy set the early guardrails: use GOV.UK form components, use error summaries and field-level errors, collect only what is needed, and avoid broad “contact details” or unnecessary personal data.

Delivery initially proposed a study-scoped setup page with local route state and tests, using a minimal D1-backed model if no suitable storage already existed.

### Initial product requirements

The first pass expected the page to let researchers:

- see who is already assigned as a note taker or observer
- add a person to the study support team
- choose a role: note taker, observer, facilitator, accessibility support, or other
- capture whether the person may attend all sessions or selected sessions only
- record whether the person is internal or external
- record role-specific notes needed to run sessions safely
- remove or edit a support person before fieldwork
- understand that observer attendance depends on participant consent and study readiness

This was directionally right, but it over-weighted “adding people” and under-weighted the equally valid case where the lead researcher is the only person joining sessions.

### Critical evaluation

The first major challenge was readiness. The early shape risked making “at least one note taker or observer exists” equivalent to “Ready”. The team rejected that because solo research can be valid and should not require a false support person record just to clear a task.

The product decision changed from “add people to become ready” to “save a clear support setup decision”. Readiness now means one of two things:

- the researcher has confirmed no additional people will join sessions
- the researcher has confirmed additional people will join and has added at least one support person

Interaction design then changed the page flow. The page should first ask: “Will anyone else join sessions for this study?” The add-person form should only appear after the researcher saves “Yes”. This avoids making an empty support people list look like a failure when solo research is a valid decision.

Content design also tightened the data collection. “Name” is enough unless the system genuinely needs a legal or full name. “Email address” remains optional and only for coordination. “Other” roles must be explained, otherwise the support record is not meaningful.

Accessibility added explicit criteria: one H1, logical heading order, grouped controls in fieldsets, error summary links that focus the relevant field, and no custom controls where GOV.UK radios, inputs, textareas or buttons already exist.

Developer input clarified the route and status behaviour. The route should be `/pages/study/note-takers-observers/?id=<StudyID>&project=<ProjectID>`, with transition support for `sid` and `pid`. The study page task should stop saying “Not available yet” and derive its status from saved route state.

### Prototype steering

The self-contained prototype confirmed the overall shape but produced three implementation steering decisions.

First, selecting “Yes” must not reveal the support people section immediately. In the prototype, doing so made “Save setup decision” feel pointless. The production page must wait until the setup decision is saved before showing the support people section.

Second, choosing role “Other” must reveal a required text input. Without that, the saved role is too vague to be operationally useful.

Third, removing a support person must require confirmation. Removal affects readiness and could accidentally erase the evidence that the study setup had been reviewed.

Those comments were deliberately carried forward as production requirements rather than being patched into the disposable prototype.

### Live environment learning

After PR #360 was merged, the authenticated live journey exposed an operational gap. A signed-in user could traverse to the page, choose “Yes, add note takers or observers”, and select “Save setup decision”, but the page showed a GOV.UK error summary containing the internal code `route_permission_missing`.

That changed the product requirements again:

- an authenticated researcher, research lead or team admin should be able to save the setup decision
- missing route-permission declarations are an implementation problem, not a user problem
- user-facing GOV.UK error summaries must never expose internal route, permission or system codes
- the route still needs permission checks, but this feature’s own D1 route-permission declarations must be safely present or bootstrapped
- if saving fails, the page must keep the setup decision unsaved and show plain-language recovery copy

The live test did not invalidate the product shape. It added a service resilience requirement: the page must behave like a normal researcher workflow when the user is authenticated, and failures must be expressed in user language.

### Current product position

The final direction is therefore not a cleansed “add people” page. It is a study readiness task where the researcher records a decision about session support, then adds support people only when the decision requires it.

The page remains grounded in GOV.UK Frontend and ResearchOps route conventions, with D1 as the primary store and Airtable as a future fallback read source when account limits allow it.

## Team discussion summary

Product: The user need is not simply to “add people”. Researchers need to make a fieldwork decision: either the lead researcher is the only person joining, or other named support people must be recorded before the setup task is ready.

Interaction design: The decision should be saved before the support-people form appears. Revealing the form immediately after a radio selection makes the save button ambiguous. Removing someone should require confirmation because removal changes readiness.

Content design: Use “Note takers and observers” as the page name, with “support people” for the list and form. “Other” roles need a required text input so the record is meaningful.

Service design: The setup task should be independent from the existing “Begin session” gate until the service explicitly decides that support people are mandatory for all fieldwork. The study page should still show whether this setup task is ready.

Technology: D1 is the primary store. Airtable is a fallback read source once the account limits are lifted, but the UI must not depend on Airtable for normal operation.

ResearchOps: The page must distinguish note takers from observers. Note takers actively help capture evidence. Observers attend but should normally not interrupt or influence the session. Some support people may join only some sessions, so the page needs an attendance scope rather than assuming full-study attendance.

User research: The page should help researchers answer who is joining, why they are joining, what they are allowed to do, and whether participants have been told observers may attend.

Accessibility: Use GOV.UK form components and patterns. Grouped choices must use fieldsets. Validation must use a GOV.UK error summary with matching field-level messages and links that move focus to the relevant field.

Privacy: Collect the minimum information needed to run sessions. Ask for an email address only if it is needed for coordination. Do not collect phone numbers, HR details, medical history or unnecessary personal notes about team members.

Developer: The route is `/pages/study/note-takers-observers/?id=<StudyID>&project=<ProjectID>`, with legacy `sid` and `pid` parameters supported by the shared study route context bridge during transition. The study page task status must be derived from saved route state, not hardcoded.

## Product decisions

- Page title: “Note takers and observers”.
- Primary user need: confirm who, if anyone, will join research sessions beyond the lead researcher.
- First question: “Will anyone else join sessions for this study?”
- Decision options:
  - “No, only the lead researcher will join”
  - “Yes, add note takers or observers”
- The support people section appears only after the researcher saves “Yes”.
- The page does not force researchers to add a person when solo research is valid.
- Readiness means a setup decision has been saved, with one nuance: if the researcher saves “Yes”, at least one support person must be added before the setup task is ready.
- “Other” role requires a text input so the support role is understandable.
- Removal requires an explicit confirmation step to prevent accidental loss.
- Observer guidance must make participant-facing expectations and consent implications visible.
- User-facing errors must use plain service copy, never internal route, permission or system codes.

## User needs

As a researcher, I need to record whether anyone else will join sessions, so that session planning is clear before fieldwork starts.

As a researcher, I need to add note takers, observers, facilitators or accessibility support people, so that I can plan who attends sessions and why.

As a researcher, I need to specify an “Other” role, so that support arrangements that do not fit the predefined roles are still understandable.

As a researcher, I need accidental removal to be prevented, so that I do not lose a support person record by mistake.

As a participant-facing service owner, I need observer attendance to be called out, so that consent material can be reviewed where observers affect the participant experience.

## Data model

Setup decisions are stored in D1 table `rops_study_support_setup`.

Support people are stored in D1 table `rops_study_support_people`.

Core fields:

- `study_id`: owning study route identifier.
- `project_id`: linked project identifier.
- `decision`: `yes` or `no`.
- `name`: support person name.
- `role`: one of `note_taker`, `observer`, `facilitator`, `accessibility_support` or `other`.
- `role_other`: required when role is `other`.
- `email`: optional coordination address.
- `attendance_scope`: one of `all_sessions`, `selected_sessions` or `not_sure`.
- `notes`: optional operational notes.
- `active`: soft-delete flag.
- `source`: `d1` or later fallback source marker.

## API behaviour

Routes:

- `GET /api/study-support?study=<study-id>` returns the saved setup decision and active support people.
- `PUT /api/study-support/setup` saves the setup decision.
- `POST /api/study-support/people` adds a support person.
- `DELETE /api/study-support/people/<person-id>` soft deletes a support person.

D1 is used first. If Airtable environment configuration is present, `GET /api/study-support` can read from Airtable when D1 has no usable records.

Access expectations:

- Authenticated researchers, research leads and team admins can view the setup.
- Authenticated researchers, research leads and team admins can save the setup decision and manage support people.
- The API remains permission-gated, but the route must not fail because the feature’s D1 route-permission declarations are missing after deployment.
- Runtime permission bootstrapping may be used for this feature’s own permission rows, role mappings and route declarations, provided the route still performs the permission check before changing study support data.
- User-facing error summaries must not expose internal machine codes such as `route_permission_missing`, `permission_denied` or `authentication_required`.
- If saving fails, the page keeps the decision unsaved and shows a plain-language recovery message.

## Acceptance criteria

Given I open the note takers and observers page, then I see GOV.UK breadcrumbs back to Projects, the project and the study.

Given no setup decision has been saved, then the setup status is Action needed.

Given I select “Yes” but do not save, then the support people form is not shown.

Given I save “No, only the lead researcher will join”, then the setup status is Ready and the support people form is hidden.

Given I save “Yes, add note takers or observers”, then the support people section is shown.

Given I save “Yes” and no support people exist, then the setup status is Action needed.

Given I add a support person with a name, role and attendance scope, then the person is shown in the support people table.

Given I choose role “Other”, then I must enter the other role before I can add the person.

Given I choose role “Observer”, then I see a GOV.UK warning about participant-facing information and consent.

Given I select Remove for a support person, then I must confirm before the person is removed.

Given I remove the only support person after saving “Yes”, then the setup status returns to Action needed.

Given I return to the study page, then “Add note takers and observers” links to this route and reflects the saved setup status.

Given I am signed in as a researcher, research lead or team admin, when I save the setup decision, then the decision is saved and I am not blocked by missing route-permission declarations.

Given an API permission or route declaration error occurs, when the page shows a GOV.UK error summary, then it shows plain-language recovery copy and does not show internal codes.

## Gherkin criteria

```gherkin
Feature: Study note takers and observers
  Researchers record whether anyone beyond the lead researcher will join sessions.

  Scenario: Save that no additional people will join
    Given I am on the note takers and observers page for a study
    When I choose "No, only the lead researcher will join"
    And I save the setup decision
    Then the setup status is "Ready"
    And I do not see the support people form

  Scenario: Save that additional people will join
    Given I am on the note takers and observers page for a study
    And I am signed in as a researcher
    When I choose "Yes, add note takers or observers"
    And I save the setup decision
    Then I see the support people form
    And the setup status is "Action needed"

  Scenario: Other role requires detail
    Given I have saved that additional people will join
    When I enter a support person name
    And I choose role "Other"
    And I choose attendance scope "All sessions"
    And I add the person
    Then I see an error asking for the other role

  Scenario: Add an observer
    Given I have saved that additional people will join
    When I enter a support person name
    And I choose role "Observer"
    Then I see a warning about participant-facing information
    When I choose attendance scope "All sessions"
    And I add the person
    Then the person appears in the support people table
    And the setup status is "Ready"

  Scenario: Confirm removal
    Given a support person has been added
    When I choose to remove them
    Then I see a confirmation prompt
    When I confirm removal
    Then the support person is removed

  Scenario: Authenticated researcher can save the setup decision
    Given I am signed in as a researcher
    And I am on the note takers and observers page for a study
    When I choose "Yes, add note takers or observers"
    And I save the setup decision
    Then the setup decision is saved
    And I do not see an error containing "route_permission_missing"

  Scenario: Internal API codes are translated for the user
    Given an API permission check fails while saving the setup decision
    When the page shows the error summary
    Then I see plain-language recovery copy
    And I do not see internal route or permission codes
```

## Privacy and governance

Only record operational information needed to run sessions. Do not record unnecessary personal data, medical history or participant information in support person notes.

Observer attendance can affect participant expectations and consent. Researchers should review participant-facing materials where observers will attend sessions.
