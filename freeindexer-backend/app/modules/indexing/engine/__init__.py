"""Free self-hosted backlink discovery / crawl / index-monitoring engine.

This package maximises URL discovery, crawl probability, verification, and
intelligent retry. It never claims that Google indexed a URL unless a
verification strategy produced supporting evidence.

Distinctions enforced throughout:

* OUR_CRAWLER_VISITED ≠ GOOGLEBOT_VISITED
* DISCOVERED ≠ CRAWLED
* CRAWLED ≠ INDEXED
* INDEXED ≠ RANKING
* HTTP 200 ≠ INDEXED
"""
from __future__ import annotations

from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.states import PipelineStatus, VisibilityStatus

__all__ = ["IndexingEngine", "PipelineStatus", "VisibilityStatus"]
