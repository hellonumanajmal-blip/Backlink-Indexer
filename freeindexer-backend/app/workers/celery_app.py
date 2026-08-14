"""Central Celery app for the FreeIndexer backend."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings


celery_app = Celery(
    "freeindexer",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_queue="default",
    task_routes={
        "indexing_engine.process_job": {"queue": "discovery"},
        "indexing_engine.process_retries": {"queue": "retry"},
        "indexing_engine.validate_url": {"queue": "url_validation"},
        "indexing_engine.verify_backlink": {"queue": "backlink_verification"},
        "indexing_engine.monitor_crawl": {"queue": "crawl_monitoring"},
        "indexing_engine.verify_index": {"queue": "index_verification"},
    },
    beat_schedule={
        "indexing-engine-retries": {
            "task": "indexing_engine.process_retries",
            "schedule": 300.0,
        },
    },
)

# Import tasks modules to register tasks on the shared app.
# These imports are intentionally side-effectful and must remain in this file.
from app.modules.knowledge_platform import tasks  # noqa: F401
from app.modules.observability import tasks as observability_tasks  # noqa: F401
from app.modules.indexing.engine import tasks as indexing_engine_tasks  # noqa: F401
