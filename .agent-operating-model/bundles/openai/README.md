# OpenAI Platform Prompt Bundle

Version: 1.0.0
Status: canonical
Source of truth: https://platform.openai.com/docs/ and https://developers.openai.com/

This bundle governs OpenAI API and OpenAI Platform integration work for ResearchOps.

It uses the existing checked-in bundle structure as packaging precedent. OpenAI-specific factual content must come only from official OpenAI documentation.

## Coverage

The bundle covers:

- Responses API
- model inputs, outputs and conversation state
- built-in tools and function calling
- Structured Outputs
- file search and vector stores
- embeddings
- Batch API
- webhooks
- Realtime API
- Evals
- rate limits and retry controls
- safety best practices and human oversight

## Operating principle

Use the Responses API as the default modern OpenAI generation interface unless the repository or official OpenAI documentation establishes another API as the correct fit.

Do not invent model capabilities, API parameters, retention behaviour, pricing, rate limits, safety guarantees or tool behaviour.

When a task affects users, research evidence, high-stakes judgement, generated code, automated decisions, or external systems, record the human review, validation, safety and failure-handling controls.
