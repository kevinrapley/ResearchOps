# MCP Agent Tooling Prompt Bundle

Version: 1.0.0
Status: canonical
Source of truth: https://modelcontextprotocol.io/

This bundle governs Model Context Protocol and agent-tooling design for ResearchOps.

It covers MCP-style tool, resource and prompt integration, consent checkpoints, tool-call validation, tool-result handling, sampling controls, roots, elicitation, logging, progress, cancellation, error handling and auditability.

## Coverage

The bundle covers:

- MCP architecture and lifecycle
- JSON-RPC message discipline
- capability negotiation
- resources
- prompts
- tools
- sampling
- roots
- elicitation
- authorization and security principles
- consent and human control
- tool-result validation and audit traces
- progress, cancellation, logging and error handling

## Operating principle

Treat tools as untrusted execution pathways until authorised, validated and bounded.

Treat resources as potentially sensitive data until permission, minimisation and provenance controls are satisfied.

Treat prompts as workflow artefacts that may influence model behaviour and require review where they affect users, evidence, code, external systems or high-stakes decisions.

Do not invent MCP protocol behaviour. Use official MCP documentation as the source of truth for protocol claims.
