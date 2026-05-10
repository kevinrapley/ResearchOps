# GOV.UK Design System Prompt Bundle

This bundle provides a comprehensive set of XML modules and schemas for
interacting with the GOV.UK Design System.  **Version 8.0.0** is the
current iteration and continues to pursue the Level 4 “Engineering Team”
capability described in Dan Shapiro’s Five Levels of AI coding.  Earlier
releases introduced core references, roles and templates (v1.x), added a
complete index of components and patterns (v3.x), incorporated page‑level
patterns and guidance from the GDS GitHub repositories (v4.x), delivered
detailed inline error‑message guidance and additional page patterns (v5.x),
and expanded component guidance for checkboxes and date inputs with new
grader checks and tests (v6.x).  **Version 8.0.0** goes further by
eliminating high‑level summaries, adding exhaustive citations and code
examples for several previously indexed components and patterns, and
introducing specialised QA and release‑readiness roles and modes.

The primary goal of this bundle is to help assistants deliver
evidence‑backed designs, implementation guidance and code using the
GOV.UK Design System and the supporting GDS code repositories.  **Version 8.0.0**
includes:

* **Expanded reference modules** that index *every* component, pattern and
  page documented on the GOV.UK Design System.  Version 8.0.0 delivers
  exhaustive guidance and code examples for several previously high‑level
  entries.  The **checkboxes** entry now includes a full HTML example with
  `<fieldset>`, `<legend>` and labelled inputs, emphasising the need to
  avoid pre‑selecting options【725289006322210†L447-L482】.  The **date‑input** entry
  shows how to mark up the day, month and year fields with labels and
  hint text【894338833679919†L415-L460】.  The **radios** entry explains grouping
  radios in a fieldset and ordering options, accompanied by a full
  code sample【194540039329074†L453-L494】.  A new **task-list** component entry
  explains when to use the task list, when not to, and provides both
  HTML and Nunjucks examples of a multi‑task list with status messages【693107159745732†L414-L433】【693107159745732†L448-L533】.
  Pattern descriptions have been enriched as well: **check answers** now
  mandates change links and pre‑population【316074223619945†L574-L640】; **complete multiple
  tasks** clarifies that users may complete tasks in any order unless
  dependencies apply【693107159745732†L414-L433】; and **confirmation pages**, **page‑not‑found**
  and **service‑unavailable** pages detail every required element and
  behavioural nuance【218965041266335†L302-L310】【224588460748559†L290-L307】【479895573779787†L284-L305】.
* **Roles** for developers, content designers, accessibility specialists,
  **QA analysts** and **release managers**.  Each role defines responsibilities,
  activation triggers and output behaviours appropriate to that discipline.
  For example, the developer role emphasises producing valid GOV.UK
  frontend code and consulting the `govuk-frontend` repository, the
  accessibility specialist focuses on WCAG 2.2 compliance and inclusive
  design, the QA role ensures tests are run and results reported, and the
  release manager verifies that the changelog and version numbers are
  correct and that documentation and tests are complete.
* **Multiple operational modes** reflecting different stages in the
  engineering process: design, build, review, **QA** and **release readiness**.
  Modes control which reference modules and graders are loaded and guide
  the assistant through tasks such as drafting guidance, generating code
  snippets, performing conformance checks, producing test checklists and
  writing release readiness assessments.
* **Extended template library** including templates for
  component guidance, pattern guidance, page design, code generation,
  conformance review and new templates for QA checklists and release
  readiness reports.  These templates prompt the assistant to assemble
  comprehensive answers that incorporate structure, behaviour, variations
  and accessibility requirements.
* **Advanced graders** that not only check for citations but also validate
  that responses adhere to the GOV.UK Design System rules.  For instance,
  graders ensure that question pages include a back link, heading and
  continue button; that error summaries move focus and link to each
  invalid field; that buttons are described in sentence case; that
  checkboxes are grouped in a fieldset and not pre‑selected; that date
  inputs use three fields grouped with a legend; and that radios and
  task lists follow their respective pattern rules.  New WCAG criteria
  enforce mention of contrast ratios when discussing colours or
  accessibility.  Additional graders support QA and release readiness
  modes by checking whether test checklists and readiness assessments
  include all required elements.
* **Improved schema contracts** for variables, output and grading.
  Variables now capture the user’s requested task, target component or
  pattern, desired response depth, operational mode and whether the task
  relates to QA or release readiness.  Outputs may include Markdown,
  code snippets and structured design advice.  Grading responses includes
  optional labels for escalation if high‑risk or unaddressed issues are
  detected.
* **Expanded test suite** with regression and red‑team tests covering
  additional components and patterns.  Version 8.0.0 adds tests for
  radios guidance, task lists, complete multiple tasks patterns and
  negative cases where the assistant misuses checkboxes, date inputs or
  task lists.  New tests ensure QA checklists and release readiness
  reports contain all expected fields.  Existing red‑team tests have been
  updated to use the `task` and `mode` variables and to challenge the
  assistant on deeper accessibility and design‑system requirements.

Version 8.0.0 pushes the bundle much closer to a gold‑standard level of
completeness.  It removes ambiguous summaries by enriching entries with
code examples and specific citations, introduces new roles and modes for
quality assurance and release readiness, expands the grader logic to cover
radios, task lists and WCAG compliance, and extends the test suite to
include negative and code‑generation scenarios.  The bundle continues to
incorporate installation, browser support and accessibility guidance from
the `govuk‑frontend` README and codifies coding standards from GDS
contribution guides.  Workflow modes guide the assistant through design,
build, review, QA and release readiness tasks, and an ever‑growing test
suite helps ensure consistency and reliability.  Further contributions are
still encouraged: there is always room to enrich the references with deeper
research and to expand the grader logic to handle more complex scenarios.