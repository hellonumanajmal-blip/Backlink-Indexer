# Enterprise Backlink Indexing Intelligence Engine — API Reference

## Base Path
`/api/indexing`

## Endpoints

### 1. Calculate Backlink Priority
- **POST** `/api/indexing/priority`
- **Request Body**: `BacklinkPriorityRequest`
- **Response**: `BacklinkPriorityResponse` (Priority Score 0-100, Level, Breakdown)

### 2. List Priority Queue
- **GET** `/api/indexing/priority/list`
- **Response**: List of `BacklinkPriorityResponse`

### 3. Get Index Predictions
- **GET** `/api/indexing/predictions`
- **Response**: `IndexPredictionResponse` (Probability Level, Percentage, Strategy, Est. Hours)

### 4. Technical Health Check
- **GET** `/api/indexing/health`
- **Response**: `IndexingHealthResponse` (HTTP Status, Canonical Match, Robots.txt, Soft 404s)

### 5. Strategy Selection
- **POST** `/api/indexing/strategies`
- **Request Body**: `StrategySelectionRequest`
- **Response**: `StrategySelectionResponse` (Recommended Strategy, Sub-strategies, Rationale)

### 6. Competitor Benchmarking
- **GET** `/api/indexing/competitors`
- **Response**: List of `CompetitorBenchmarkResponse`

### 7. Indexing Growth Forecast
- **GET** `/api/indexing/forecast`
- **Response**: `ForecastResponse` (Weekly & Monthly Growth Rates, Recovery Probability)

### 8. AI Recommendations
- **GET** `/api/indexing/recommendations`
- **Response**: List of `RecommendationResponse`

### 9. Workflow Automation Rules
- **GET** `/api/indexing/workflows`
- **POST** `/api/indexing/workflows`
- **Response**: List or single `AutomationRuleResponse`

### 10. Submission History
- **GET** `/api/indexing/history`
- **Response**: List of `SubmissionHistoryResponse`
