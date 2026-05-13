## 8.0.1 – Form affordance and vertical-rhythm controls

* Added `references/govuk-form-affordance-reference.xml` and loaded it by default from `prompt.body.xml` and `prompt.spec.yaml`.
* Added explicit GOV.UK form rules requiring agents to make width decisions for text inputs, textareas and selects rather than relying on full-width defaults.
* Added vertical-rhythm rules requiring agents to separate introductory content, inset text and the first form group using the GOV.UK spacing scale.
* Clarified that common text inputs such as full name, email address and team or service should normally use a sensible fluid width such as `govuk-!-width-two-thirds` unless the context supports a different width.

## 2.0.0 – Expanded guidance and gold‑standard improvements

* Added new reference modules for components (`govuk-components-reference.xml`) and patterns (`govuk-patterns-reference.xml`), covering error summaries, buttons and date inputs with detailed rules and citations.
* Added a designer role module (`roles/designer.xml`) to provide context‑aware responsibilities and output behaviours for design tasks.
* Added a new template for question page guidance (`templates/question-page-guidance.xml`) and updated the component guidance template to version 2.0.
* Updated `prompt.spec.yaml` to load the new reference and template modules by default and to register the designer role.
* Enhanced the grader (`graders/design-system-behaviour.xml`) to include criteria that check for sentence case guidance on buttons, structural requirements for question pages and focus/link guidance for error summaries.
* Bumped the bundle version to 2.0.0 and updated the registry manifest accordingly.
## 1.0.0 – Initial release

* Added `prompt.body.xml`, `prompt.spec.yaml`, `variables.schema.json`,
  `output.schema.json` and `grade.schema.json` to define the structure of the
  bundle.
* Added a reference module summarising key GOV.UK Design System guidance with
  citations from the official website.
* Added a component guidance template that uses the reference module to
  structure answers about individual components.
* Added a simple grader module that checks for the presence of citations.
* Added minimal regression and red‑team test cases.

## 3.0.0 – Full design-system coverage and engineering workflow

* Added a comprehensive index of all components, patterns and pages within the
  GOV.UK Design System.  The new reference entries outline when to use each
  component or pattern and direct the assistant to the official pages for
  authoritative details.  Detailed guidance remains for back link, error
  summary, error message, button and question pages, while the remaining
  components are summarised generically.
* Added new roles (`developer.xml`, `content-designer.xml` and
  `accessibility-specialist.xml`) to support engineering tasks beyond
  high‑level design.  Each role defines responsibilities and output
  behaviours appropriate to that discipline.
* Added multiple operational modes (design, build and review) and updated
  `prompt.spec.yaml` to allow selecting a mode.  Modes control which
  reference modules and graders are loaded at runtime.
* Expanded the variables schema to include `task`, `mode`, `component` and
  `pattern` properties, enabling more granular prompts and guidance.
* Added new templates for page design, code generation and conformance
  review.  These templates instruct the assistant to produce structured
  guidance and valid GOV.UK frontend code, referencing macros from the
  `govuk-frontend` repository.
* Added advanced grader modules that verify structural requirements,
  accessibility considerations and code conformance.  The graders warn
  about missing back links on question pages, missing headings in error
  summaries, and the absence of GOV.UK classes in generated code.
* Expanded the test suite with additional regression and red‑team cases
  covering new components and patterns.  These tests ensure the assistant
  can handle a wider range of design and build requests without
  regressions.
* Bumped the bundle version to 3.0.0 and updated the registry manifest and
  documentation accordingly.

## 4.0.0 – Complete coverage and GDS repository integration

* **Comprehensive page patterns:** Added detailed guidance for page‑level patterns
  such as **confirmation pages**, **page not found pages** and **service
  unavailable pages**.  Each new pattern summarises when to use it and lists
  mandatory elements that must appear on the page.  For example, confirmation
  pages should include a reference number, details of what happens next,
  contact information, relevant links, a feedback link and a way to save the
  transaction record【218965041266335†L295-L313】.  Page‑not‑found pages and
  service‑unavailable pages specify the required page titles, headings, and
  guidance on what information to display and what to avoid【224588460748559†L273-L307】【998457885816499†L284-L305】.
* **Expanded components:** Introduced an **error‑message** component entry
  describing when to display inline error messages, how to present them
  adjacent to inputs and the requirement to prefix them with “Error:” for
  screen‑reader users【886695524985236†L343-L387】.
* **GDS GitHub reference:** Added a new reference module summarising
  essential guidance from the GDS GitHub repositories.  This includes
  installation and update instructions for GOV.UK Frontend, browser and
  assistive‑technology support, accessibility obligations, security and
  vulnerability disclosures and contributions guidelines.  The module also
  covers coding standards such as BEM naming conventions, component folder
  structures, the use of the `.govuk-` namespace and 2‑space indentation
  recommended in the coding standards【681682623149550†L6-L24】【681682623149550†L168-L190】.
* **Integration with `govuk-frontend` repository:** Updated the design‑system
  reference to summarise the “Quick start” installation instructions, browser
  support grades and accessibility requirements from the `govuk-frontend`
  README【794161067120215†L24-L39】【794161067120215†L42-L63】【794161067120215†L71-L87】.
* **New operational modes:** Added explicit **design**, **build** and **review**
  workflow definitions in the `modes` directory.  Each mode loads the
  appropriate reference modules, templates and graders to guide the assistant
  through drafting guidance, generating code and performing conformance
  reviews.
* **Updated specifications:** Bumped `prompt.spec.yaml` and
  `prompt.body.xml` to version 4.0.0.  The specification now loads the
  new reference modules by default and exposes a `mode` variable allowing
  callers to switch between design, build and review flows.
* **Additional tests:** Added new regression tests (and updated red‑team tests) for the
  confirmation page pattern, page not found pattern and service unavailable
  pattern.  These tests verify that guidance mentions mandatory elements and
  cites the appropriate design system sources.
* **Documentation refresh:** Updated the README to reflect version 4.0.0
  features and to emphasise the inclusion of GDS GitHub guidance and
  comprehensive page pattern coverage.

## 5.0.0 – Extended page patterns and inline error guidance

* **Inline error messages:** Added a dedicated **error‑message** component entry in the components reference.  It describes when to display inline error messages (only for validation errors) and when not to use them (for eligibility or service issues)【315030580910858†L343-L359】.  The entry explains how to position and style error messages with red text and borders, how to preserve user input and how to prefix messages with a visually hidden “Error:” for screen‑reader users【315030580910858†L369-L389】.
* **Additional page patterns:** Introduced new patterns for **confirmation pages**, **page‑not‑found pages** and **service‑unavailable pages**.  Each pattern includes requirements for titles, headings, content and behaviour.  For example, confirmation pages must include a reference number, next‑step information, contact details, links to relevant services, a feedback link and a way for users to save a record of the transaction【218965041266335†L302-L310】.  Page‑not‑found pages set the title and heading to “Page not found” and include clear, blame‑free content without technical jargon【224588460748559†L290-L307】.  Service‑unavailable pages specify the required title and H1, describe when the service will be available and explain what happens to users’ answers【479895573779787†L284-L295】.
* **Version updates:** Bumped the patterns reference module to version 3.0 to reflect the new page patterns and updated all module and bundle versions to **5.0.0**.  Updated the changelog, README, registry manifest, prompt specification and prompt body to reflect the new version and features.
* **Test updates:** Added regression tests (and updated red‑team tests) for the new page patterns and the error‑message component, ensuring the assistant includes mandatory elements, highlights accessibility considerations and cites the correct sources.  Updated tests to use the `task` and `mode` variables rather than the deprecated `active_mode`.

## 6.0.0 – Detailed component and pattern guidance, WCAG compliance and deeper tests

* **Rich component guidance:** Added detailed guidance for the **checkboxes** and **date‑input** components.  For checkboxes, the reference now cites official rules for when to use them (selecting multiple options), when not to use them (use radios for single choices), and how to structure them with fieldsets and legends.  It also highlights that options should not be pre‑selected, should be ordered alphabetically or by frequency, and that checkboxes should sit to the left of their labels【152890019095117†L390-L434】.  For the date input, the reference clarifies that it should be used only when users know the exact date, presents three separate day, month and year fields grouped within a fieldset, and notes that month names may be entered in full or abbreviated form【894338833679919†L369-L401】.
* **New pattern: check answers:** Added a **check‑answers** pattern entry summarising when to use a check answers page, how it works and the behavioural requirements.  The guidance explains that check answers pages should appear before the confirmation page; that they help users review and correct their answers; and that each section should include a “Change” link so users can update their responses.  The pattern also notes that long transactions may use multiple check answers pages and that responses should be pre‑populated when users go back to edit them【316074223619945†L574-L640】.
* **Accessibility emphasis:** Introduced a new criterion in the design‑system behaviour grader to enforce colour and contrast guidance.  When responses mention colours or accessibility, the grader now requires the answer to reference WCAG 2.2 contrast ratios or note that the GOV.UK colour palette meets these standards【529411222321622†L196-L223】.
* **Additional grader checks:** Added criteria to ensure that answers about checkboxes mention grouping them within a fieldset and not pre‑selecting options, that answers about date inputs mention the three separate fields and fieldset legend, and that answers about check answers pages mention including change links and pre‑populating answers.  These checks help the assistant adhere to the most important behavioural rules.
* **Expanded tests:** Added regression tests for the new checkboxes, date input and check answers guidance.  Added red‑team tests that attempt to misuse checkboxes (for example, suggesting to pre‑select options) or recommend using a single text field for dates; the grader flags these as failures unless the assistant corrects the misuse.  Also introduced an accessibility red‑team test that asks for colour advice to ensure the assistant mentions contrast requirements.
* **Version bump:** Updated all version references to **6.0.0** in the README, specification, prompt body and registry manifest.  The reference modules that were updated (components and patterns) have been versioned accordingly.  Updated the changelog entry to document these changes.

## 8.0.0 – Comprehensive guidance, specialised roles and modes, deeper tests

* **Exhaustive component guidance:** Extended several previously summarised components with detailed rules and full HTML examples.  The **checkboxes** entry now includes a code sample showing a `<fieldset>` with `<legend>`, hint text and individual `<input>` and `<label>` pairs, and stresses that options must not be pre‑selected【725289006322210†L447-L482】.  The **date‑input** entry contains a complete markup example for day, month and year fields grouped in a fieldset with a legend and labels【894338833679919†L415-L460】.  The **radios** entry now explains grouping radios within a fieldset and ordering options, accompanied by a code example【194540039329074†L453-L494】.  A new **task‑list** component entry describes when to use a task list and provides a multi‑task example with statuses and links, both in HTML and using the Nunjucks macro【693107159745732†L414-L533】.
* **Enriched pattern descriptions:** Added detailed descriptions for patterns such as **complete multiple tasks**, clarifying that tasks can usually be completed in any order unless dependencies exist【693107159745732†L414-L433】.  Enhanced the **check answers** entry to specify that each answer must have a “Change” link and that answers must be pre‑populated when users revisit the page【316074223619945†L574-L640】.  Confirmation pages, page‑not‑found pages and service‑unavailable pages now enumerate all mandatory elements and behaviours【218965041266335†L302-L310】【224588460748559†L290-L307】【479895573779787†L284-L305】.
* **Specialised roles and modes:** Introduced **QA** and **release‑manager** roles with responsibilities such as running the test suite, verifying version numbers and documentation completeness.  Added corresponding **qa** and **release‑readiness** modes and templates to support automated checklists and readiness assessments.
* **Deeper grader checks:** Added new criteria to the design‑system behaviour grader to enforce radios guidance (mentioning fieldsets and legends), task list guidance (indicating tasks can be completed in any order) and to check for WCAG contrast references whenever colours or accessibility are discussed.  Updated existing criteria to support the new roles and modes.
* **Expanded tests:** Added regression tests for radios guidance, task lists, complete multiple tasks and expanded check answers behaviour.  Added red‑team tests that challenge the assistant with negative scenarios, such as using a single input for dates or including interactive elements in confirmation panels.  Added tests for QA checklist and release readiness outputs.
* **Documentation updates:** Updated the README to version 8.0.0, listing new features and emphasising exhaustive guidance, specialised roles and deeper tests.  Updated `prompt.spec.yaml`, `prompt.body.xml`, `registry-manifest.yaml`, and other metadata to reference version 8.0.0 and include the new roles, modes, templates and graders.