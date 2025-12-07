# New Page Design Pattern with RDFa, SKOS and HTML

This guide outlines the recommended structure for new pages in the ResearchOps platform.  
It combines semantic HTML5 with **RDFa annotations** so that pages become machine-readable using open vocabularies such as:

- **Dublin Core** (`dcterms`)
- **Schema.org** (`schema`)
- **SKOS** (`skos`)

It also follows the GOV.UK design system for accessible typography and colours.

---

## General principles

### **Semantic HTML5**
Use structural elements (`header`, `main`, `nav`, `section`, `footer`, etc.) to convey meaning.  
CSS must remain separate from structure.

### **RDFa annotations**
Annotate elements with:

- `typeof`
- `property`
- `resource`
- `about`

Stable URIs should be used when defining RDF prefixes  
(see: `docs/devops/custom-instructions/developer.xml` lines 61–73).

### **Accessibility**
- Use correct heading levels  
- Provide labels for all form controls  
- Ensure WCAG AA colour contrast  
- Use ARIA only when needed  
- Maintain keyboard operability  

### **Meta information**
Every page must include:

- `schema:name`
- `schema:creator`
- `schema:dateModified` (update every edit)
- `dcterms:language`

These make pages indexable and interoperable for agent-based automation.

### **Reuse partials**
Use `<x-include>` to include common UI layout:

- Header  
- Footer  
- Any shared navigation  

Partials accept variables via the `vars` attribute.

### **Use GOV.UK classes**
Wrap the main content in:

```html
<main class="govuk-body">
```

Use `govuk-width-container`, `govuk-heading-l`, `govuk-back-link`, etc.

### **Data attributes**
When a page depends on dynamic items (e.g., project IDs), declare:

```html
data-project-id=""
data-study-id=""
```

These are read by your ES module components.

---

# Template for a New Page

Below is the recommended template for creating any new project-level page (e.g. “Impact & ROI”).  
Replace placeholder values where appropriate.

```html
<!doctype html>
<html lang="en-GB"
      data-api-origin="https://your-api.example.com"
      prefix="
        dcterms: http://purl.org/dc/terms/
        schema:  https://schema.org/
        skos:    http://www.w3.org/2004/02/skos/core#
      ">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <title>Example Page — ResearchOps</title>

  <link rel="stylesheet" href="/css/govuk/govuk-typography.css" />
  <link rel="stylesheet" href="/css/govuk/govuk-colours.css" />
  <link rel="stylesheet" href="/css/screen.css" />

  <script type="module" src="/components/layout.js"></script>
</head>

<body typeof="schema:WebPage"
      resource="#page"
      about="#page"
      vocab="https://schema.org/">

  <!-- Page metadata -->
  <meta property="schema:name" content="Example Page — ResearchOps" />
  <meta property="schema:creator" content="Home Office ResearchOps Platform" />
  <meta property="schema:dateModified" content="2025-12-07" />
  <meta property="dcterms:language" content="en-GB" />

  <!-- Header -->
  <x-include src="/partials/header.html" vars='{
      "active": "Projects",
      "subtitle": "Example Page"
  }'></x-include>

  <main class="govuk-body"
        role="main"
        data-project-name=""
        data-project-id=""
        typeof="schema:ResearchProject"
        resource="#project">

    <!-- Breadcrumbs -->
    <nav class="breadcrumbs" aria-label="Breadcrumb" typeof="schema:BreadcrumbList">
      <ol>
        <li property="schema:itemListElement" typeof="schema:ListItem">
          <a href="/pages/projects/" property="schema:item" typeof="schema:Thing">
            <span property="schema:name">Projects</span>
          </a>
          <meta property="schema:position" content="1" />
        </li>

        <li property="schema:itemListElement" typeof="schema:ListItem">
          <a id="breadcrumb-project" href="#" property="schema:item" typeof="schema:Thing">
            <span property="schema:name">Project</span>
          </a>
          <meta property="schema:position" content="2" />
        </li>

        <li property="schema:itemListElement"
            typeof="schema:ListItem"
            aria-current="page">
          <span property="schema:name">Example Page</span>
          <meta property="schema:position" content="3" />
        </li>
      </ol>
    </nav>

    <!-- Back link -->
    <a id="back-link" class="govuk-back-link" href="#">Back to project dashboard</a>

    <!-- Hero -->
    <div class="dashboard-hero">
      <p id="eyebrow-org"
         class="project-org"
         property="schema:sourceOrganization"
         typeof="schema:Organization"></p>

      <h1 id="project-title"
          class="govuk-heading-l"
          property="schema:name">Example Page</h1>

      <p id="project-subtitle"
         class="lede"
         property="schema:description">
        Describe the purpose of this page here.
      </p>
    </div>

    <!-- Main component root -->
    <section id="component-root"
             data-project-id=""
             data-study-id="">
      <!-- JS components populate here -->
    </section>

  </main>

  <x-include src="/partials/footer.html"></x-include>

  <!-- Scripts -->
  <script type="module" src="/components/example-component.js"></script>

  <script type="module">
    (function() {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("id");

      if (projectId) {
        const root = document.getElementById("component-root");
        if (root) root.setAttribute("data-project-id", projectId);

        const breadcrumbProject = document.getElementById("breadcrumb-project");
        if (breadcrumbProject)
          breadcrumbProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;

        const backLink = document.getElementById("back-link");
        if (backLink)
          backLink.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}#outcomes`;
      }
    })();
  </script>

</body>
</html>
```

---

## Implementation notes

- Update **`schema:dateModified`** whenever the file changes.  
- Adjust **header include variables** (`active`, `subtitle`).  
- Rename **`component-root`** to match the component on your page.  
- Include **SKOS prefix** only if required.  
- Keep styles in CSS — avoid inline styling.  
- Use partials (`<x-include>`) for shared UI components.

