# Phase 7 — Migration Notes

**Phase:** AI Explanation Layer, Intelligence Reports & Enterprise Integrations  
**Date:** 2026-07-27  
**Depends on:** Phases 1–6

## Summary

Phase 7 adds an explanation and reporting layer on top of Phase 6 deterministic intelligence. LLMs never calculate Discovery, Health, Quality, or Indexability scores. They explain, summarise, and rewrite recommendations using redacted evidence packs only.

Default provider is **`mock`** (offline-safe). Remote providers are optional via configuration.

## Database changes

Alembic revision: `007_explainer` (revises `006_intelligence`).

| Table | Purpose |
|-------|---------|
| `ai_prompts` | Versioned prompt templates |
| `ai_interactions` | Auditable AI request/response metadata |
| `ai_usage_daily` | Per-user daily token/request budgets |
| `assistant_conversations` | Chat conversation headers |
| `assistant_messages` | Chat turns + evidence hash |
| `intelligence_digests` | Generated digests |
| `digest_schedules` | Digest schedule configuration |
| `integration_endpoints` | Outbound delivery endpoints |
| `intelligence_report_jobs` | Exportable intelligence report jobs |

## Provider architecture

Interchangeable via `AI_PROVIDER` / `AI_FALLBACK_PROVIDER`:

- OpenAI, Azure OpenAI, Anthropic, Google Gemini
- Ollama, LM Studio, vLLM, HuggingFace (OpenAI-compatible where applicable)
- Mock + Template fallback (always available)

Chain: primary → fallback → mock/template. Application code depends on the provider interface only.

## Prompt system

Seeded slugs (version `1.0.0`): `chat_system`, `executive_summary`, `technical_summary`, `recommendation_rewrite`, `digest_intro`.

Templates live in `ai_prompts`. New versions can be inserted without code changes; active row wins.

## Context builder

Builds evidence from Phase 6 scores, recommendations, anomalies, broken links, duplicates, predictions, and deterministic opportunity ranking. Redacts passwords, tokens, API keys, cookies, session IDs, and `pda_` secrets.

## Opportunity ranking

Deterministic formula: priority weight + impact weight + discovery-score gap. LLM only narrates the ranked list.

## API additions (non-breaking)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/assistant/providers` | `assistant.view` |
| GET | `/api/intelligence/providers` | `assistant.view` |
| POST | `/api/assistant/explain` | `assistant.view` |
| POST | `/api/assistant/chat` | `assistant.chat` |
| GET | `/api/assistant/opportunities` | `assistant.view` |
| POST | `/api/intelligence/digest` | `digests.manage` |
| GET | `/api/intelligence/reports` | `reports.generate` |
| POST | `/api/intelligence/reports/generate` | `reports.generate` |

Existing Phase 1–6 endpoints unchanged.

## RBAC

New permissions: `assistant.view`, `assistant.chat`, `assistant.manage`, `digests.manage`. Seeded into default roles (viewer: view only; analyst/editor: view+chat; admin: manage+digests).

All explain/chat/digest/report actions write audit events.

## Cost & privacy controls

- `AI_MAX_TOKENS`, `AI_MAX_REQUESTS_PER_MINUTE`, `AI_DAILY_TOKEN_BUDGET`, `AI_CACHE_TTL_SECONDS`
- Response cache keyed by prompt slug + context hash + provider
- Budget exceeded → template fallback
- Secrets never included in evidence packs
- Interactions logged in `ai_interactions`

## Integrations

Outbound delivery foundation: Telegram, Slack, Discord, Teams, generic webhooks, email foundation. Digest `deliver_channel` selects channel; env webhook URLs used when configured.

## Background jobs

Celery: `digests.generate` (period/format/channel).

## UI

`/internal/assistant` — Chat, Executive Summary, Recommendations, Opportunity Ranking, Reports, Digests, Provider Status, Conversation History.

## Deploy

```bash
cd backend
alembic upgrade head
# optional: export AI_PROVIDER=openai OPENAI_API_KEY=...
# restart API + worker
```

Verify:

```bash
curl -s http://localhost:8000/health   # phase: 7
pytest backend/tests -q
```

## Performance observations

- Mock explain/chat typically &lt;50ms locally (no network).
- Cache hits return prior explanation with zero provider tokens.
- Evidence packs are truncated for ranking/recommendation lists to keep prompt size bounded.
- Remote provider latency dominates when configured; track `latency_ms` in `ai_interactions`.

## Rollback

```bash
alembic downgrade 006_intelligence
```

Remove assistant router import if rolling application code back. Phase 6 scoring tables and APIs remain intact.
