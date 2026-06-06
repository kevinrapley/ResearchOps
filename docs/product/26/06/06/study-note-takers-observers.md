# Study note takers and observers

Date: 2026-06-06
Status: production implementation branch
Route: `/pages/study/note-takers-observers/`

## Purpose

The page lets a researcher confirm whether anyone beyond the lead researcher will join study sessions, and record the operational details needed to manage those people before fieldwork starts.

It exists because note takers, observers, facilitators and accessibility support can affect planning, participant consent and the session experience. The page keeps that setup visible as a study task without making researchers record unnecessary personal data.

## Team discussion summary

Product: The user need is not simply to “add people”. Researchers need to make a fieldwork decision: either the lead researcher is the only person joining, or other named support people must be recorded before the setup task is ready.

Interaction design: The decision should be saved before the support-people form appears. Revealing the form immediately after a radio selection makes the save button ambiguous. Removing someone should require confirmation because removal changes readiness.

Content design: Use “Note takers and observers” as the page name, with “support people” for the list and form. “Other” roles need a required text input so the record is meaningful.

Service design: The setup task should be independent from the existing “Begin session” gate until the service explicitly decides that support people are mandatory for all fieldwork. The study page should still show whether this setup task is ready.

Technology: D1 is the primary store. Airtable is a fallback read source once the account limits are lifted, but the UI must not depend on Airtable for normal operation.

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
```

## Privacy and governance

Only record operational information needed to run sessions. Do not record unnecessary personal data, medical history or participant information in support person notes.

Observer attendance can affect participant expectations and consent. Researchers should review participant-facing materials where observers will attend sessions.
