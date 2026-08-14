# Backlink Priority Scoring Model

## Priority Score Formula (0–100)
The priority score is calculated using multi-factor heuristics:

```
Priority Score = (Authority Score * 0.50) + (Traffic & Spam Score * 0.25) + (Mechanics Score * 0.15) + (Quality & Freshness Score * 0.10)
```

### Factors & Weights:
1. **Domain & Page Authority**: Domain Authority (25%), Page Authority (15%), Referring Domain Trust (10%).
2. **Referring Traffic & Spam**: Logarithmic traffic scale (15%), Spam score penalty (10%).
3. **Link Mechanics**: Placement quality (in-content vs footer) (8%), Follow vs Nofollow modifier (0.5x), HTTP Status & Redirect penalties (12%).
4. **Quality & Freshness**: Content quality (10%), Freshness score (5%).

### Priority Levels:
- **Critical**: 80 – 100
- **High**: 60 – 79
- **Medium**: 40 – 59
- **Low**: 0 – 39
