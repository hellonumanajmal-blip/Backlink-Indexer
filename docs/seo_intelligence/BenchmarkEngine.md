# Benchmark Engine Documentation

## Overview
The `BenchmarkEngine` compares customer target domain telemetry against monitored competitor domains.

## Comparison Metrics
- **Referring Domains**: Difference in unique referring domains count.
- **Backlink Gap**: Total backlink count comparison.
- **Indexed Pages**: Coverage gap across search index pages.
- **Visibility Score**: Normalized metric comparing search engine exposure.
- **Health Score**: Structural health comparison based on HTTP status, indexability, and spam risk.
- **Growth Rate & Link Velocity**: Comparative net acquisition speed.

## Calculation Formula
```python
benchmark_score = max(0.0, min(100.0, round(50.0 + (visibility_gap * 2.0) + (referring_domains_gap * 0.05), 1)))
```
