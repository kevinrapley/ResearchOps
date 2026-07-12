# Flux UK English writing signals

## Task summary

Add richer writing-behaviour metadata while keeping entered text on the ResearchOps page and measuring spelling and grammar against UK English.

## Decisions

- Declare `en-GB` in every linguistic result and test accepted UK spellings against rejected US variants.
- Run the dictionary and grammar checks in the visitor's browser after behavioural analytics consent.
- Export only bounded counts for words, possible spelling and grammar issues, letter case and all-capital words.
- Never export entered text, individual words, possible misspellings, corrections or suggestions.
- Continue excluding email, telephone, password and one-time-code fields and support an explicit per-field opt-out.
- Treat all results as possible service-friction signals, never as a judgement or automated decision about a person.

## Implementation

The build bundles `nspell` with a compact `dictionary-en-gb` dictionary split into two static chunks below the repository's 512 KB per-asset budget. A conservative local grammar analyser reports only pattern counts. The tracker sanitises the analyser response against a fixed allow-list and falls back to the normal timing event if analysis is unavailable.

Every rendered ResearchOps page loads the analyser before tracker cache key `v=1.2.9`. The consent copy explicitly describes local UK English analysis and states that entered text does not leave the page.

## Validation

- Unit tests verify UK variants such as “colour” and “organise” are accepted while corresponding US variants produce possible spelling issues.
- VM tracker tests verify the raw textarea value is absent from the outbound event and only derived counts are exported.
- Route-state tests require the analyser and cache-busted tracker on every rendered page.
- Build validation checks the generated analyser and dictionary assets.

## Residual risk

Dictionary and grammar signals can be wrong for names, specialist terms, dialects, disability-related patterns and stylistic choices. Operational use remains blocked on representative golden-corpus, accessibility and privacy validation.
