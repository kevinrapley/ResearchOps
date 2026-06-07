# Research repository product direction

Date: 2026-06-07  
Status: Product direction for implementation  
Branch: `feature/repository-front-page-nunjucks-sass`  
Related PR: #365

## Purpose

The ResearchOps platform is moving from project, study and insight capture towards a curated research repository.

The repository must help teams identify, search, tag, group and classify reusable research evidence. It must do this with a government and enterprise-level posture. It must be authenticated. It must not surface PII. It must only expose artefacts that researchers or Research Operations have deliberately released to the repository.

The repository is not a dumping ground for raw research material. It is a curated publication layer over the ResearchOps lifecycle.

## Core recommendation

Build the research repository as a top-level authenticated product area at:

```text
/pages/repository/
```

Use API routes under:

```text
/api/repository
/api/repository/artefacts
/api/repository/artefacts/:id
```

The repository should be a trusted evidence library, not a dashboard and not a raw archive.

It should expose reviewed, reusable, non-PII artefacts with clear provenance, confidence, reuse guidance and review state.

## Product direction

The repository should sit above projects and studies as a cross-cutting knowledge space.

Projects and studies remain the places where research is planned, conducted, analysed and synthesised. The repository is where selected outputs are released for reuse.

A repository artefact may originate from one study, but its value is cross-project. The artefact must therefore carry its source context with it.

A published repository artefact must show:

- title
- artefact type
- source project
- source study
- method
- date range
- evidence basis
- confidence level
- evidence maturity
- limitations
- reuse guidance
- where not to use the evidence
- tags and taxonomy
- PII clearance state
- consent-scope confirmation
- owner
- reviewer
- review date
- linked recommendations or decisions where available

## What the repository must not do

The repository must not expose:

- participant names
- participant contact details
- recruitment records
- consent records
- raw session notes
- recordings
- transcripts
- draft studies
- unreleased synthesis
- candidate artefacts to ordinary repository users
- internal consultation notes as user-facing content
- technical failure details in user-facing error panels

The user-facing page must not show internal assurance phrases such as `Repository status`. It must not show implementation detail such as `Technical detail: Not found`.

## Route shape

The repository is a top-level authenticated destination:

```text
/pages/repository/
```

The repository should not be placed under:

```text
/pages/projects/repository/
/pages/studies/repository/
/pages/projects/{project-id}/repository/
```

Those paths wrongly imply that the repository is subordinate to a single project or study.

Contextual links may point into the repository from project, study, synthesis and recommendation pages, but the canonical route remains `/pages/repository/`.

## Front page direction

The front page should be a service entry point, not a dashboard.

It must include:

- clear service heading
- clear proposition
- prominent search
- stable repository summary copy
- repository summary metric cards
- published artefact results area
- visible filter controls
- publish-to-repository entry point
- explanation of what each artefact must show
- curator workbench structure

The front page must not include:

- team consultation notes
- design rationale panels
- internal status panels
- technical diagnostic messages
- mock artefact content
- unresolved loading copy as permanent content

## Nunjucks ownership

The Nunjucks template owns stable page structure and copy.

The template must include:

- repository summary copy
- metric card structure
- filter controls
- curator workbench copy
- curator workbench table structure
- user-facing error copy
- links and route destinations

The template must use GOV.UK Frontend macros where suitable. The search input and search button are macro-rendered. The filter controls use GOV.UK checkbox macros.

The template must not rely on JavaScript to create the fundamental user interface structure.

## Sass ownership

Sass owns route-specific layout only.

Sass must not override GOV.UK typography scale for metric labels and numbers. Repository metric numbers should use GOV.UK typography classes such as `govuk-heading-xl`. Labels should use GOV.UK body classes such as `govuk-body`.

Generated CSS must not be committed. It is produced during the Cloudflare build from:

```text
src/styles/repository.scss
```

The output registration points to:

```text
public/css/repository.css
```

## Rendered HTML ownership

Rendered HTML must not be committed.

The Nunjucks page source is:

```text
src/govuk/templates/pages/repository.njk
```

The Cloudflare build renders the output to:

```text
public/pages/repository/index.html
```

Tests should check the Nunjucks template and build registration, not a committed rendered HTML file.

## D1 and API ownership

D1 and API routes own dynamic data only.

The API must derive:

- summary metric counts
- published artefact result rows
- filter counts
- curator queue counts

The API must not own stable user-facing copy or page structure.

The API route is authenticated and backed by D1.

The repository API returns only published, active artefacts where:

```text
status = 'published'
active = 1
pii_cleared = 1
consent_scope_confirmed = 1
```

The API response should include a `derivation` object that explains where each derived value comes from.

## Data derivation

Repository summary metrics are derived from D1 aggregate counts across:

```text
rops_repository_artefacts
rops_repository_artefact_tags
```

Published artefacts are derived from:

```text
rops_repository_artefacts
```

Filters are derived from D1 facet counts over:

```text
method
evidence_maturity
service_area
risk_area
```

Curator queues are derived from D1 workflow-status counts for:

```text
candidate artefacts
due review
withdrawn artefacts
```

Curator queue counts are only returned to users with `repository.curate` permission.

## Error handling

User-facing errors must be plain and non-technical.

Do show:

```text
Could not load repository data
Repository data could not be loaded. Try again or contact the ResearchOps team if the problem continues.
```

Do not show:

```text
Technical detail: Not found
repository_api_error
stack traces
raw upstream messages
SQL errors
route diagnostics
```

Technical diagnostics belong in logs and observability, not in the user-facing repository page.

## Consultation view

### Information architecture

The information architecture position is that the repository is a cross-cutting evidence space. It should support search, filtering, taxonomy, artefact types, confidence labels and evidence maturity.

The IA concern is findability with provenance. Users must be able to understand what an artefact is, where it came from, and how safely it can be reused.

IA direction:

- use a top-level repository route
- support structured filtering as well as search
- use controlled vocabulary for key facets
- keep provenance visible
- avoid turning repository content into decontextualised snippets

### Service design

The service design position is that the repository front page must be a service entry point. It should help different actors start from the same place but follow different routes.

Researchers may want to publish or reuse artefacts. Product managers may want evidence for decisions. Research Operations may need curator queues. Governance colleagues may need confidence, provenance and review state.

Service design direction:

- show the purpose of the repository clearly
- keep the interface task-based
- avoid dashboard clutter
- make publication and reuse rules visible
- keep backstage governance visible only where it helps user action
- keep internal design rationale out of the user-facing page

### Research Operations

The Research Operations position is that curation and release governance must be explicit.

ResearchOps owns the repository workflow, release states, review queues, taxonomy health, and stale artefact management. ResearchOps does not reinterpret evidence on behalf of researchers.

ResearchOps direction:

- candidate artefacts must move through a review workflow
- published artefacts must have PII clearance and consent-scope confirmation
- stale and withdrawn artefacts must be managed
- curation queues should be available to authorised users
- repository quality should be measured by reuse of trusted evidence, not by raw volume

### User research

The user research position is that the repository must preserve the distinction between evidence, insight and recommendation.

A repository artefact should not flatten research into unsupported claims. It must keep evidence basis, confidence and limitations visible.

User research direction:

- distinguish observations, findings, insights and recommendations
- require evidence links
- require limitations
- require confidence level
- include reuse guidance
- prevent over-generalisation

### Privacy

The privacy position is that the repository must be non-PII by design.

Raw research material stays outside the repository index. Published artefacts must be cleared for PII and consent scope before publication.

Privacy direction:

- no participant identity data
- no consent records
- no raw session notes
- no recordings
- no transcript search in the repository
- clear publication gates
- authenticated access

### Security

The security position is that repository content may still be sensitive even where no PII is present.

The repository must sit behind authentication and route permission checks. Repository APIs must not be public static data feeds.

Security direction:

- authenticated routes
- server-side permission checks
- no static public repository index
- no browser fallback to raw CSV
- audit relevant publication and curation actions
- protect curator routes with permission checks

### Product management

The product management position is that the MVP should prove the core trust loop, not attempt to become a complete knowledge management system.

MVP direction:

- show the repository route
- search published artefacts
- filter by key facets
- show provenance and confidence
- expose curator queues to authorised users
- support candidate artefact creation path
- back dynamic data with D1
- avoid premature AI synthesis or semantic search over raw research material

## Acceptance criteria

A user cannot access repository data unless authenticated.

Search and filters return only published artefacts that the signed-in user may view.

A published artefact is only returned when it is active, PII-cleared and consent-scope confirmed.

Repository summary copy is rendered by Nunjucks.

Repository summary card structure is rendered by Nunjucks.

Filter controls are rendered by Nunjucks.

Curator workbench structure is rendered by Nunjucks.

D1/API supplies counts and result rows only.

User-facing error panels do not show upstream technical details.

Generated CSS is not committed.

Generated HTML is not committed.

Tests assert Nunjucks, Sass, API and build-registration contracts, not committed generated output.

## Open questions

The product still needs decisions on:

- final controlled vocabulary for repository facets
- publication workflow details
- review cadence for stale artefacts
- whether curator queues should be visible to all researchers or only ResearchOps/lead roles
- how artefacts link to recommendations and decisions
- how repository artefact detail pages should be structured
- whether semantic search is introduced later and, if so, what curated text is eligible for indexing
