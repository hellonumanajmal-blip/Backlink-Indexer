# Reasoning and Planning

The reasoning layer is deliberately composable and does not duplicate existing workflow business logic. It provides a lightweight plan-and-execute pattern for autonomous tasks, short/long context handling, and retry-aware orchestration.

The planning strategy uses:

- deterministic plan creation
- multi-step reasoning
- bounded tool calling
- approval checkpoints
- memory-aware execution context
