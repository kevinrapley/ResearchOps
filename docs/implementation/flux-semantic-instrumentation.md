# Flux semantic instrumentation

ResearchOps supplies controlled, content-free data attributes so Flux can describe a visitor journey using service purpose instead of DOM position.

## Attribute contract

- `data-flux-page` identifies the rendered page, for example `page.projects-journals`.
- `data-flux-key` identifies the purpose and control type, for example `tab.journal.analysis`, `button.analysis.code-retrieval`, `field.analysis.code-retrieval` or `form.auth.otp-verify`.
- `data-flux-role` may be only a role accepted by the shared Flux event schema: `field`, `form`, `control`, `page`, `service` or `environment`.
- `data-flux-sensitive="true"` excludes the element from interaction capture in addition to the tracker's built-in email, telephone, password and one-time-code exclusions.
- `data-flux-autofocus="true"` identifies a field that the service deliberately focuses after another control opens its region. It does not change browser focus behaviour.

Keys must match `[A-Za-z0-9._:-]{1,120}` and describe stable service purpose. They must not contain visible or entered text, email addresses, names, record identifiers, project identifiers, query-string values or other user content. ResearchOps does not contain or execute a local analytics engine: the single hosted Flux module owns capture, validation and any defensive fallback.

Explicit publisher keys always win. Flux Behaviour may derive a defensive purpose from controlled structure such as an element ID, field name or safe destination path, but that interpretation lives in the Flux repository and never reads query strings, visible text, accessible names or entered values. A positional `auto.*` key remains the final fallback for a genuinely contextless control. Important ResearchOps journeys must provide authored purpose-led attributes; focus-management and display-only targets are not controls, and custom controls must expose an interactive role such as `role="button"`.

When a control changes purpose at runtime, its key must change with it. For example, the shared account link uses `link.account.sign-in` while signed out and `link.account.dashboard` after the header resolves an authenticated account.

Flux-owned consent controls carry explicit semantic keys and roles in the hosted module.

Progressive-disclosure journeys should instrument the complete interaction: the opening button, containing form, focused field, submit button and cancel button. Focus entry is emitted as `field.focus.auto`, `field.focus.pointer`, `field.focus.keyboard` or `field.focus.programmatic`. Field blur records total focus time, pre-input dwell, active typing duration and rate, printable keys, Backspace/Delete use, pastes and revisits as separate bounded values. Dwell ends at the first keyboard, input or paste interaction; typing rate uses only the first-to-latest typing interval. Modified Ctrl/Cmd shortcuts end pre-input dwell but do not start typing time or increase character counts. Input events also establish active-entry timing for IME and mobile entry; only inserted data length is counted and no character content is retained or exported. A recent pointer or Tab interaction remains only the focus-exit method.

## UK English writing indicators

Consented text areas and ordinary text/search fields are checked locally against the `en-GB` dictionary. The browser exports only bounded derived counts: words, possible spelling issues, possible grammar issues, upper- and lower-case letters, and all-capital words. The typed value, individual words, misspellings, suggested corrections and grammar fragments never enter the Flux event and never leave the page. Email, telephone, password and one-time-code fields remain excluded, and a field can opt out with `data-flux-writing-analysis="false"`.

Grammar is a deliberately conservative local heuristic rather than proof of correctness. It detects patterns such as lower-case sentence starts, repeated adjacent words, a lower-case standalone “i”, punctuation spacing, repeated punctuation and missing terminal punctuation. Names, specialist terms, dialect, disability, educational background and writing style can produce false positives. These indicators may identify service friction; they must not be used to infer literacy, intelligence, professionalism, personality or protected characteristics, and must not drive an automated decision about a person.

The analyser, dictionary and build process are owned and hosted by Flux Behaviour. The hosted module performs the check in the visitor's browser and sends only the bounded count bundle to the collector with credentials omitted. ResearchOps contains no dictionary, spelling code or linguistic runtime. A failed analyser degrades to the content-free timing event, and the Flux consent banner explains the local UK-English check.

## Authentication milestones

The hosted Flux module derives the fixed, content-free `auth.otp.requested`, `auth.otp.succeeded` and `auth.otp.failed` milestones from the attributed OTP forms, the pending browser-session state and the attributed account page. ResearchOps exposes only those semantic attributes; it does not call an analytics API from its authentication code.

The email and one-time-code fields remain excluded from click, focus, dwell, character-count, correction and content capture. Milestones never include the email, code, code length, challenge ID or authenticated account identity.

## Visitor and session lifecycle

The hosted Flux module keeps the pseudonymous visitor identifier in local storage and rolls its tab-scoped session identifier after 30 minutes without a captured interaction. ResearchOps does not implement or store analytics lifecycle logic itself.

## Rendering and testing

Generated GOV.UK pages receive their page key from `scripts/govuk/render-govuk-pages.mjs`; shared navigation keys for Home, Start a project, Projects, Research repository, Sourcebook, account actions and the mobile menu live in `public/partials/header.html`; page-specific navigation and control keys belong in their canonical Nunjucks template. The project dashboard's Project areas menu uses `link.project-area.*` keys. Static route shells outside that renderer must be updated directly. Every page loads only `https://flux-behaviour.pages.dev/assets/flux/sdk/flux-auto-capture.mjs` with endpoint and tenant configuration attributes.
The Sourcebook contents, pillar cards, breadcrumbs and related-route links, together with project-dashboard participant, stakeholder, user-group, journal and outcomes controls, carry explicit semantic keys so keyboard journeys remain meaningful without URL-derived inference.
