# ResearchOps brand variants

Date: 2026-06-09
Branch: `feature/ho-brand-variant`
Scope: Shared page chrome brand variant for Home Office colours and logo.

## Purpose

ResearchOps keeps GOV.UK Frontend, GOV.UK component classes and the shared page structure as the default service architecture.

The brand-variant layer changes only the visible brand treatment for a Home Office variant:

- Home Office SVG logo wordmark
- Home Office purple `#732282`
- Home Office internal-service page background `#f5f5f5`
- Home Office border grey `#cbcbcb`

The GOV.UK variant remains the default.

## Source guidance

The Home Office UCD Manual says internal Home Office services should use Home Office design styles, including the Home Office page template, Roboto and Home Office colours.

The Home Office colour guidance defines:

- brand colour: `#732282`
- page background: `#f5f5f5`
- border: `#cbcbcb`

It also says text and links should continue to use GOV.UK colours because they are accessible with the Home Office page background.

## Activation

The runtime selector supports three activation routes:

1. `?brand=home-office`
2. `<meta name="researchops-brand" content="home-office">`
3. a hostname containing `home-office` or `homeoffice`

Use `?brand=govuk` to return to the default GOV.UK variant and clear the persisted override.

## Files

- `public/partials/header.html` keeps the default GOV.UK logo and adds the Home Office SVG logo as a hidden alternative.
- `public/js/brand-variant.js` selects and applies the active brand.
- `src/styles/brands/home-office.scss` is the Sass source for the Home Office colour layer.
- `public/css/brands/home-office.css` is the generated CSS output.
- `scripts/styles/generated-css-targets.mjs` registers the Sass source and CSS output with the generated CSS build.
- `tests/brand-variant-route-state.test.js` protects the brand-selector and Sass-generation contract.

## Build contract

Run:

```text
npm run build:generated-css
```

That compiles `src/styles/brands/home-office.scss` into `public/css/brands/home-office.css` through the same generated-CSS pipeline used by the other ResearchOps-owned stylesheets.

## Boundaries

This is not a second design system.

Do not fork GOV.UK components, form structures, typography rules, validation patterns, route-specific page layouts or interaction behaviour for the Home Office variant unless a later product decision explicitly expands the brand boundary.

## Validation

Run:

```text
npm test -- --ci
```

For a manual browser check, open any page with:

```text
?brand=home-office
```

Then check that the GOV.UK crown is replaced by the Home Office SVG logo, the header uses the Home Office colour treatment, and the wider page keeps the same components and layout.
