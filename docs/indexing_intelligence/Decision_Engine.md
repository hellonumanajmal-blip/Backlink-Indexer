# Decision Engine Specification

## Overview
The Decision Engine orchestrates heuristic scoring, technical health evaluations, and automated rules to pick optimal submission routes and resubmission schedules.

## Decision Flow
1. Receive backlink metadata and technical signals.
2. Evaluate priority score (0–100) using `IntelligenceScoringEngine`.
3. Audit technical health using `IntelligenceHealthEngine`.
4. If health is degraded (<60), route to **Discovery Refresh**.
5. If priority & health are both high (>=80), trigger **Hybrid Strategy** (IndexNow + WebSub + Queue).
6. Evaluate active automation rules via `IntelligenceRulesEngine`.
7. Store decision history in `strategy_history` and `submission_history`.
