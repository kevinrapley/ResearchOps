# Accessibility evidence fixture: passing release decision

## Fixture purpose

This Markdown fixture represents human-readable accessibility evidence for a repository release gate.

It is synthetic evidence. It is designed to exercise the GitHub Diamond accessibility evidence validator and to show the minimum narrative needed before an agent may describe accessibility evidence as release-supporting.

## Automated checks

- axe-core smoke check passed with 0 violations.
- Pa11y check passed against the representative page with 0 issues.
- Lighthouse accessibility score was recorded at 1.0.
- Automated evidence files were retained with the fixture output so the result can be inspected, not only asserted.

## Manual keyboard checks

- Tab order was checked from header to footer.
- All links, buttons and form controls were reached using keyboard only.
- The primary journey was completed using keyboard only.
- No keyboard trap was found.
- Skip-link behaviour was checked before the main content journey.

## Focus management checks

- Visible focus indicator was confirmed on links, buttons and form controls.
- Focus moved to the error summary after form submission errors.
- Focus returned to the relevant field when an error-summary link was activated.
- Modal-style focus, where present, was constrained and restored after close.

## Screen reader smoke checks

- NVDA with Firefox announced the page title, headings, field labels and error summary.
- VoiceOver with Safari announced the main landmarks and form controls in the expected order.
- Form errors were associated with the relevant fields.
- Status messages used text that did not depend on colour alone.

## Form and error checks

- Error messages were specific and placed before the relevant field.
- Required fields were announced.
- Hints and errors were linked to form controls through accessible descriptions.
- The page remained usable at 200% zoom without loss of content or functionality.

## Assistive technology matrix

| Technology | Browser | Platform | Result |
| --- | --- | --- | --- |
| NVDA | Firefox | Windows | pass |
| VoiceOver | Safari | macOS | pass |

## Known defects

- `AX-001` was a low-severity copy clarification defect.
- `AX-001` is closed.
- No open high or critical accessibility defects are recorded.
- No release-blocking accessibility defects are recorded.

## Release decision

- `pass`

The fixture may support a release decision because automated results, keyboard evidence, focus behaviour, screen-reader evidence, known-defect status and release decision are all present.
