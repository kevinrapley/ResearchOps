# Flux semantic instrumentation

ResearchOps supplies controlled, content-free data attributes so Flux can describe a visitor journey using service purpose instead of DOM position.

## Attribute contract

- `data-flux-page` identifies the rendered page, for example `page.projects-journals`.
- `data-flux-key` identifies the purpose and control type, for example `tab.journal.analysis`, `button.analysis.code-retrieval`, `field.analysis.code-retrieval` or `form.auth.otp-verify`.
- `data-flux-role` may be only a role accepted by the shared Flux event schema: `field`, `form`, `control`, `page`, `service` or `environment`.
- `data-flux-sensitive="true"` excludes the element from interaction capture in addition to the tracker's built-in email, telephone, password and one-time-code exclusions.
- `data-flux-autofocus="true"` identifies a field that the service deliberately focuses after another control opens its region. It does not change browser focus behaviour.

Keys must match `[A-Za-z0-9._:-]{1,120}` and describe stable service purpose. They must not contain visible or entered text, email addresses, names, record identifiers, project identifiers, query-string values or other user content. The tracker retains neutral positional fallback keys where a controlled key is absent rather than guessing meaning from the DOM.

Before capture, the tracker writes semantic attributes onto every current interactive element and observes newly rendered controls. Explicit publisher keys always win. Missing keys are derived only from controlled structural attributes such as an element ID, field name, action attribute, destination path, controlled region or form identity. Query strings, visible text, accessible names and entered values are never used. A positional `auto.*` key remains the final defensive fallback, but normal ResearchOps controls should receive a purpose-led key before an interaction occurs. Focus-management and display-only targets are excluded from control capture; custom controls must expose an interactive role such as `role="button"`.

When a control changes purpose at runtime, its key must change with it. For example, the shared account link uses `link.account.sign-in` while signed out and `link.account.dashboard` after the header resolves an authenticated account.

Progressive-disclosure journeys should instrument the complete interaction: the opening button, containing form, focused field, submit button and cancel button. Focus entry is emitted as `field.focus.auto`, `field.focus.pointer`, `field.focus.keyboard` or `field.focus.programmatic`. Field blur records a recent pointer or Tab interaction only as the focus-exit method; printable key counts remain keyboard input and typed content is never captured.

## Authentication milestones

The tracker exposes `window.researchOpsFlux.milestone(action, elementKey)` for the fixed allow-list `auth.otp.requested`, `auth.otp.succeeded` and `auth.otp.failed`. It emits only after behavioural analytics consent, only on production ResearchOps hosts, and uses the schema-valid `trust` event class with the neutral `auth.otp` element key.

The email and one-time-code fields remain excluded from click, focus, dwell, character-count, correction and content capture. Milestones never include the email, code, code length, challenge ID or authenticated account identity.

## Visitor and session lifecycle

The visitor identifier remains in local storage so Flux can recognise a returning browser without identifying the person. The session identifier is tab-scoped and rolls after 30 minutes without a captured interaction. Each captured interaction refreshes the activity timestamp. Trackers deployed before this boundary stored no activity timestamp, so their legacy session is replaced on the first captured interaction after the updated asset loads.

## Rendering and testing

Generated GOV.UK pages receive their page key from `scripts/govuk/render-govuk-pages.mjs`; shared navigation keys for Home, Start a project, Projects, Research repository, Sourcebook, account actions and the mobile menu live in `public/partials/header.html`; page-specific navigation and control keys belong in their canonical Nunjucks template. The project dashboard's Project areas menu uses `link.project-area.*` keys. Static route shells outside that renderer must be updated directly. Run the GOV.UK build and check committed `public/` output together with the source templates.
