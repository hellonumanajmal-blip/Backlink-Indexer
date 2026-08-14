# Prompt Engine

The prompt subsystem stores prompt templates with versioning, variables, validation rules, and scores. It is intentionally backend-driven so enterprise governance can review and optimize prompt behavior centrally.

Key capabilities:

- Variable resolution
- Version tracking
- Validation hooks
- Prompt scoring
- Historical storage via the prompts table
- Reuse for multi-tenant agent configuration
