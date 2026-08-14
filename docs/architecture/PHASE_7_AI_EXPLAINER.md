# Phase 7 — AI Explanation Layer, Intelligence Reports & Enterprise Integrations

**Status:** Complete  
**Depends on:** Phases 1–6  
**Rule:** Deterministic Phase 6 scores remain the **single source of truth**. LLMs never calculate scores. No breaking HTTP contracts. No secrets in prompts. No indexing guarantees.

---

## Honest limitations

- Explanations are grounded only in stored platform data (scores, recs, anomalies, validations, pipeline).
- If context is empty or confidence is low, the assistant must say so — never invent metrics.
- Remote providers are optional; **MockProvider** always works offline for tests and degraded mode.
- Digests/reports without a provider still render from deterministic templates.

---

## Goals

1. Provider-agnostic AI explainer (OpenAI, Azure, Anthropic, Gemini, Ollama, LM Studio, vLLM, HF, Mock).
2. Deterministic **context builder** for prompts (no secrets).
3. Versioned **prompt registry**.
4. Chat assistant + executive/technical summaries.
5. Deterministic **opportunity ranking** (LLM explains ranks only).
6. Scheduled **intelligence digests** (daily/weekly/monthly/quarterly).
7. Exportable intelligence reports (PDF/MD/HTML/JSON; DOCX foundation).
8. Integration delivery: Telegram, Email (foundation), Slack, Discord, Teams, webhooks.
9. Cost controls, caching, rate limits, fallback, RBAC, audit.

## Non-goals

- Changing Phase 6 scoring formulas.
- Letting LLMs invent Health/Discovery/Quality/Indexability scores.
- Multi-tenant SaaS billing (Phase 8+ foundation only).

---

## AI architecture

```
User / Digest scheduler / Report job
        │
        ▼
┌──────────────────┐
│ Assistant API    │  RBAC + audit + rate limit
└────────┬─────────┘
         ▼
┌──────────────────┐
│ ContextBuilder   │  loads Phase 6 + ops data; redacts secrets
└────────┬─────────┘
         ▼
┌──────────────────┐
│ PromptRegistry   │  versioned templates + render
└────────┬─────────┘
         ▼
┌──────────────────┐
│ ExplainerService │  cache → provider → fallback Mock/template
└────────┬─────────┘
         ▼
┌──────────────────┐
│ ProviderRouter   │  config-selected LLMProvider
└──────────────────┘
```

**Modules**

| Module | Role |
|--------|------|
| `context_builder/` | Assemble evidence packs |
| `ai_explainer/` | Providers, prompts, chat, explain |
| `intelligence_reports/` | Exportable reports |
| `digests/` | Scheduled digest generation + delivery |
| `integrations/` | Telegram/Slack/Discord/Teams/email/webhook adapters |

---

## Provider abstraction

```python
class LLMProvider(Protocol):
    name: str
    def available(self) -> bool: ...
    def complete(self, request: LLMRequest) -> LLMResponse: ...
```

- Config: `AI_PROVIDER=mock|openai|azure_openai|anthropic|gemini|ollama|...`
- Keys only from env/settings — never logged or sent back to clients.
- Missing key → provider `available() == False` → fallback chain: primary → secondary → mock/template.

---

## Prompt architecture

Table `ai_prompts`: `slug`, `version`, `template`, `active`, `created_at`.  
Seeded defaults: `executive_summary`, `technical_summary`, `chat_system`, `recommendation_rewrite`, `digest_intro`.  
Every completion stores `prompt_slug` + `prompt_version` on `ai_interactions`.

---

## Context builder

Builds JSON evidence:

- Latest scores (discovery, indexability, quality_*)
- Active recommendations (priority sorted)
- Anomalies, broken links, duplicates (top N)
- Predictions + disclaimers
- Validation/pipeline rollups (counts, rates)
- Opportunity ranking (deterministic)

Redaction: strip cookies, tokens, passwords, `Authorization`, webhook secrets, env secrets.

---

## Security model

Permissions:

- `assistant.view`, `assistant.chat`, `assistant.manage`
- `reports.generate` (reuse/extend analytics reports if present)
- `digests.manage`

All explain/chat/report/digest actions → audit log.  
AI requests logged in `ai_interactions` (no prompt secrets).

---

## Cost controls

- `ai_max_tokens`, `ai_max_requests_per_minute`, `ai_daily_token_budget`, per-user daily quota
- Response cache keyed by `sha256(prompt_slug|version|context_hash|provider)`
- On budget/provider failure: template fallback (deterministic prose from context)

---

## Privacy

Never include: passwords, API tokens, session cookies, secrets, raw webhook secrets.  
URLs may be included only for owned/tracked backlink URLs already in DB.

---

## Rate limiting & caching

- In-process sliding window per user/IP for `/assistant/*`
- TTL cache (default 300s) for identical explain requests

---

## Fallback behaviour

1. Try configured provider  
2. Try `AI_FALLBACK_PROVIDER`  
3. `MockProvider` / template renderer that cites evidence fields only  

---

## Opportunity ranking (deterministic)

Score = `priority_weight(P0=40,P1=25,P2=15,P3=5) + impact_weight + (100-discovery_score)/5`  
LLM only narrates the ranked list.

---

## Digests & reports

- Digests: period aggregates + template sections; optional LLM executive intro  
- Reports: reuse Phase 4 exporters where practical + intelligence-specific builders  
- Delivery via `integrations` adapters

---

## Database (`007_explainer`)

- `ai_prompts`
- `ai_interactions` (chat/explain audit)
- `ai_usage_daily` (token budgets)
- `assistant_conversations` / `assistant_messages`
- `intelligence_digests`
- `digest_schedules`
- `integration_endpoints` (channel configs; secrets hashed/ref only)

---

## API additions

| Method | Path |
|--------|------|
| GET | `/api/assistant/providers` |
| POST | `/api/assistant/explain` |
| POST | `/api/assistant/chat` |
| GET | `/api/intelligence/providers` |
| POST | `/api/intelligence/digest` |
| GET | `/api/intelligence/reports` |
| POST | `/api/intelligence/reports/generate` |
| GET/PUT | `/api/digests/schedules` (manage) |

---

## Testing strategy

Mock provider unit tests, prompt render, context redaction, ranking determinism, chat/explain API authz, digest generation without network, cache hit, fallback path, full regression green.

---

## Future compatibility

Provider + context + prompt registry remain stable for multi-tenant SaaS, public API, and autonomous agents without redesigning Phase 6 scoring.
