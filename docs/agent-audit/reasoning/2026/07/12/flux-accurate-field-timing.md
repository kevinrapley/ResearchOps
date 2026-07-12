# Flux accurate field timing

## Task summary

Correct ResearchOps field timing so Flux can distinguish inactivity before input from active typing and total focus time.

## Root cause

The tracker used the focus-to-blur interval for both `duration_ms` and characters-per-minute. Flux therefore described active entry as dwell and a pre-input pause reduced the reported typing speed.

## Implementation

- Record the first keyboard, input or paste interaction after focus.
- Record the first and latest printable, Backspace or Delete typing key.
- Emit `dwell_before_input_ms`, `typing_duration_ms` and total `duration_ms` separately.
- Calculate `chars_per_minute` only across the active typing interval.
- Count Backspace and Delete consistently without recording key identity beyond that correction category.
- Advance every tracker reference to cache key `v=1.2.8`.

## Validation

- The focused VM regression simulates a 1.4-second pre-input dwell, 26.3 seconds of active typing, 101 printable keys and three Delete keys.
- Route-state validation requires both new metadata fields and cache key `v=1.2.8` across every rendered page.

## Privacy and interpretation

All emitted values are bounded counts or durations. No typed value or printable key identity is exported. Backspace/Delete use is correction behaviour, not proof of a spelling mistake.
