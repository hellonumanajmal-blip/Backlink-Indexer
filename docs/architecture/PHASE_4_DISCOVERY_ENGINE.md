# Phase 4 Discovery Engine Architecture

## Overview
Phase 4 builds a deterministic discovery intelligence engine on top of the existing project, campaign, backlink, queue, and pipeline foundation. The engine evaluates technical evidence and produces scores, health metrics, and actionable recommendations without claiming search-engine indexing.

## Discovery Architecture
The discovery engine is composed of independent modules:
- Validation
- HTTP Analysis
- Technical Analysis
- Content Analysis
- Discovery Analysis
- Quality Analysis
- Recommendation Engine

## Processing Flow
1. Validation checks URL syntax, protocol, redirect chain, status code, and response characteristics.
2. HTTP analysis inspects robots directives, canonical tags, metadata, and headers.
3. Technical analysis looks at performance, redirects, sitemap presence, and link structure.
4. Content analysis inspects title, description, headings, and content depth.
5. Discovery analysis evaluates crawlability and discoverability signals.
6. Quality analysis aggregates the evidence into quality scores.
7. The recommendation engine generates deterministic suggestions.
8. The final discovery result stores scores and history.

## Scoring Model
The engine calculates deterministic scores in the range 0–100:
- HTTP score
- Crawlability score
- Canonical score
- Robots score
- Metadata score
- Content score
- Structured data score
- Link quality score
- Redirect quality score
- Performance score

## Validation Layers
The engine validates:
- URL format
- Redirect chain
- Final URL
- HTTPS
- Status code
- Response time
- Robots.txt
- X-Robots-Tag
- Meta robots
- Canonical
- hreflang
- Sitemap presence
- Open Graph
- Twitter Card
- Structured data
- Internal links
- External links
- Content length
- Title
- Description
- Headers (H1–H6)

## Crawlability Analysis
Crawlability is inferred from technical evidence such as redirect quality, robots directives, status codes, and page response behavior.

## Discovery Signals
The engine records discovery signals such as canonical status, robots directives, sitemap availability, structured data presence, metadata richness, and heading structure.

## Health Engine
The health score combines technical health, crawlability, metadata quality, page quality, response quality, and redirect quality into a deterministic 0–100 score.

## Recommendation Engine
Recommendations are generated deterministically with:
- reason
- impact
- priority
- estimated improvement

Examples include fixing robots directives, removing noindex, adding canonical, improving title/meta description/H1, improving schema, reducing redirects, improving response time, and adding social metadata.

## Event Flow
The engine emits internal events:
- AnalysisStarted
- ValidationFinished
- ScoresCalculated
- RecommendationsGenerated
- AnalysisCompleted

## Database Design
Phase 4 adds tables for:
- discovery_results
- health_scores
- quality_scores
- recommendations
- analysis_history

These tables preserve historical evidence while allowing repeatable re-analysis.

## Testing Strategy
Tests cover:
- Discovery engine execution
- Score calculations
- Recommendation generation
- Health scoring
- Validation heuristics
- History retention
- Retry behavior
- API surface stability
