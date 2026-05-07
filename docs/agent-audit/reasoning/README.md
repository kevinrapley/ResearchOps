# Agent audit trace

The agent audit trace is an engineering control for repository-affecting AI work.

It is not a transcript of private chain-of-thought. It is a structured record of what the agent did, which operating-model rules it applied, what evidence it consulted, what decisions it made, what commands it ran, what changed, what failed and how it pivoted.

## Trace model

Raw trace events are written as append-only JSONL under `.agent-traces/raw/`.

Human-readable reports can be rendered under this directory when a task includes `[reasoning]` or when an operator promotes a trace for review.

Each event records:

- a trace ID
- an event ID
- timestamp
- event type
- actor metadata
- trace layer
- redaction metadata
- previous event hash
- event hash

The previous hash and event hash form a tamper-evident event chain.

## Required decision boundaries

Repository-affecting agent work should use traced boundaries for:

- prompt and trigger capture
- bundle detection and application
- file reads
- file writes
- shell commands
- decisions
- assumptions
- risks
- issues
- pivots
- report rendering
- validation completion

This prevents the final report being a reconstruction from memory.

## Privacy boundary

Trace events must not include raw secrets, bearer tokens, API keys or unnecessary personal data.

Sensitive parameters should be redacted or represented by a hash where the exact value is not needed for review.

## Commands

Validate raw traces when present:

```bash
npm run trace:validate
```

Run the regression suite:

```bash
npm test
```

The regression test proves redaction, bundle recording, file boundaries, report rendering and hash-chain validation.
