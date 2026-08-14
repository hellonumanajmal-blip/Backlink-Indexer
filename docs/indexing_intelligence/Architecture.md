# Enterprise Backlink Indexing Intelligence Engine — Architecture

## Overview
The Enterprise Backlink Indexing Intelligence Engine is the central decision-making brain of the Backlink Indexer SaaS Platform. It provides dynamic priority scoring, index probability prediction, technical health monitoring, automated workflow triggers, and submission strategy optimization.

## Layered Clean Architecture
```
+-----------------------------------------------------------------------+
|                 REST API Layer (/api/indexing/*)                      |
+-----------------------------------------------------------------------+
|                         IntelligenceService                           |
+-----------------------------------------------------------------------+
|  Scoring  |  Forecast  |  Resubmission  |  Health   | Strategy  | AI   |
|  Engine   |   Engine   |    Engine      |  Engine   | Selector  | Recs |
+-----------------------------------------------------------------------+
|                     IntelligenceRepository (Async)                    |
+-----------------------------------------------------------------------+
|                      PostgreSQL (Alembic 0006)                        |
+-----------------------------------------------------------------------+
```

## Key Components
1. **IntelligenceScoringEngine**: Dynamic priority score calculation (0–100).
2. **IntelligenceForecastEngine**: Predicts indexing probability levels and expected time to index.
3. **IntelligenceHealthEngine**: Continuous monitoring of technical health indicators.
4. **IntelligenceStrategySelector**: Automatic selection of RSS, Sitemap, WebSub, IndexNow, or Hybrid strategy.
5. **IntelligenceRulesEngine**: IF-THIS-THEN-THAT automated workflow triggers.
6. **IntelligenceRecommendationsEngine**: Actionable AI recommendations.
7. **IntelligenceRepository**: Async SQLAlchemy persistence with tenant isolation.
