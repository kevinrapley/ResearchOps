# Flux UK writing dictionary authentication fix

## Root cause

ResearchOps protects static routes with the authenticated service boundary. The on-device analyser requested its UK dictionary with credentials omitted, so the request could receive the sign-in HTML instead of dictionary data even for a signed-in visitor.

## Fix

Fetch the three same-origin dictionary resources with `credentials: "same-origin"`. The cookie remains scoped to ResearchOps and is not exposed to Flux. The cross-origin analytics collector continues to use `credentials: "omit"`.

## Validation

- The built analyser bundle must contain `credentials:"same-origin"` and must not contain `credentials:"omit"`.
- Focused analyser, privacy, tracker and rendered-route tests pass.
- Production verification must confirm an authenticated browser receives dictionary data and a new journey produces the bounded `en-GB` event bundle.
