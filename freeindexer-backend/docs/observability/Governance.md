# Governance Platform

## Policy types

- `tenant` — tenant operating policies
- `ai_usage` — AI token/model constraints
- `workflow` — workflow governance rules
- `provider` — provider allow/deny rules
- `data_retention` — retention governance

## Lifecycle

1. Create draft policy (`POST /governance/policies`)
2. Approve (`POST /governance/policies/{id}/approve`) → status `active`
3. Version (`POST /governance/policies/{id}/version`) → new draft version

Policies are versioned integers; approval resets on each version bump.
AI usage evaluation helpers validate token/model constraints against active rules.
