"""Empirical indexing experiment: control group, baseline, stats, export."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.modules.indexing.engine.experiment_stats import (
    MIN_N,
    build_experiment_report,
    experiment_channel_names,
    export_csv,
    export_rows,
    two_proportion_p,
    wilson_interval,
    quality_band,
    rel_type_from_rel,
)
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.quality import assign_experiment_group
from app.modules.indexing.engine.scheduler import experiment_verify_action
from app.modules.indexing.engine.states import PipelineStatus, PropertyType, VisibilityStatus
from app.modules.indexing.engine.verification import (
    CustomSearchStrategy,
    IndexVerificationService,
    ManualVerificationStrategy,
    VerificationResult,
)
from app.modules.indexing.indexer_dispatch import normalise_url, url_fingerprint

from tests.test_indexing_engine import TENANT, live_pages


def _job(**kwargs):
    now = datetime.now(timezone.utc)
    defaults = dict(
        source_url="https://src.example/a",
        source_domain="src.example",
        experiment_group="A",
        experiment_started_at=now - timedelta(days=3),
        experiment_eligible=True,
        baseline_status="ELIGIBLE",
        visibility_status=VisibilityStatus.UNKNOWN.value,
        pipeline_status=PipelineStatus.RETRY_PENDING.value,
        public_listed=False,
        googlebot_visited=False,
        indexed_at=None,
        discovery_completed_at=now - timedelta(days=2),
        discovery_started_at=now - timedelta(days=2, hours=1),
        last_checked_at=now,
        quality_score=70,
        quality_band="medium",
        priority_band="MEDIUM",
        backlink_rel_type="dofollow",
        page_freshness="fresh",
        attempt_count=1,
        indexed_before_retry=None,
        channel_snapshot={},
        verification_status="UNKNOWN",
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_group_assignment_is_hash_mod_4_and_stable():
    url = "https://src.example/stable-experiment"
    fp = url_fingerprint(normalise_url(url) or url)
    assert assign_experiment_group(fp) == assign_experiment_group(fp)
    assert assign_experiment_group(fp) in {"A", "B", "C", "D"}
    assert assign_experiment_group("00000000" + "a" * 56) == "A"
    assert experiment_channel_names("A") == ()
    assert experiment_channel_names("B") == ("public_hub",)
    assert "websub" in experiment_channel_names("C")
    assert experiment_channel_names("D") == experiment_channel_names("C")


def test_rel_and_quality_bands():
    assert rel_type_from_rel("nofollow sponsored") == "sponsored"
    assert rel_type_from_rel("ugc") == "ugc"
    assert rel_type_from_rel("nofollow") == "nofollow"
    assert rel_type_from_rel("") == "dofollow"
    assert quality_band(90) == "high"
    assert quality_band(70) == "medium"
    assert quality_band(45) == "low"


def test_empty_study_is_inconclusive():
    report = build_experiment_report([])
    assert report["verdict"]["answer"] == "INCONCLUSIVE"
    assert report["totals"]["eligible"] == 0
    assert report["groups"]["A"]["sample_status"] == "INSUFFICIENT_DATA"
    assert report["groups"]["A"]["verified_index_rate"] is None


def test_baseline_already_indexed_excluded_from_rate():
    started = datetime.now(timezone.utc)
    excluded = _job(
        experiment_eligible=False,
        baseline_status="BASELINE_ALREADY_INDEXED",
        visibility_status=VisibilityStatus.INDEXED.value,
        indexed_at=started,
        experiment_group="B",
    )
    eligible_unknown = _job(experiment_group="B", experiment_started_at=started)
    report = build_experiment_report([excluded, eligible_unknown])
    assert report["totals"]["baseline_already_indexed_excluded"] == 1
    assert report["groups"]["B"]["eligible"] == 1
    assert report["groups"]["B"]["indexed"] == 0


def test_insufficient_data_not_a_winner():
    jobs = [_job(experiment_group="A") for _ in range(10)] + [_job(experiment_group="B") for _ in range(10)]
    report = build_experiment_report(jobs)
    assert report["verdict"]["answer"] == "INCONCLUSIVE"


def test_yes_verdict_requires_significant_lift():
    started = datetime.now(timezone.utc) - timedelta(days=5)
    control = [_job(experiment_group="A", experiment_started_at=started) for _ in range(MIN_N)]
    treated = []
    for group in ("B", "C", "D"):
        for i in range(MIN_N):
            indexed = i < 20
            treated.append(
                _job(
                    experiment_group=group,
                    experiment_started_at=started,
                    visibility_status=VisibilityStatus.INDEXED.value if indexed else VisibilityStatus.UNKNOWN.value,
                    indexed_at=started + timedelta(days=2) if indexed else None,
                    public_listed=True,
                )
            )
    report = build_experiment_report(control + treated)
    assert report["verdict"]["answer"] in {"YES", "POSSIBLE"}
    assert report["groups"]["B"]["sample_status"] == "OK"


def test_no_verdict_when_treated_not_better():
    started = datetime.now(timezone.utc) - timedelta(days=5)
    control = [
        _job(
            experiment_group="A",
            experiment_started_at=started,
            visibility_status=VisibilityStatus.INDEXED.value if i < 12 else VisibilityStatus.UNKNOWN.value,
            indexed_at=started + timedelta(days=1) if i < 12 else None,
        )
        for i in range(MIN_N)
    ]
    treated = [
        _job(experiment_group=g, experiment_started_at=started)
        for g in ("B", "C", "D")
        for _ in range(MIN_N)
    ]
    report = build_experiment_report(control + treated)
    assert report["verdict"]["answer"] in {"NO", "INCONCLUSIVE"}


def test_wilson_and_export_omit_secrets():
    low, high = wilson_interval(12, 100)
    assert 0 <= low <= high <= 1
    assert two_proportion_p(12, 100, 12, 100) == 1.0
    job = _job()
    rows = export_rows([job])
    csv_text = export_csv([job])
    blob = (str(rows) + csv_text).lower()
    assert "gsc_access" not in blob
    assert "bearer" not in blob
    assert "url" in csv_text
    assert rows[0]["experiment_group"] == "A"


def test_funnel_layers_are_separate():
    started = datetime.now(timezone.utc)
    jobs = [
        _job(experiment_group="B", public_listed=True, experiment_started_at=started),
        _job(
            experiment_group="B",
            public_listed=True,
            googlebot_visited=True,
            visibility_status=VisibilityStatus.CRAWLED.value,
            experiment_started_at=started,
        ),
        _job(
            experiment_group="B",
            public_listed=True,
            visibility_status=VisibilityStatus.INDEXED.value,
            indexed_at=started + timedelta(days=1),
            experiment_started_at=started,
        ),
    ]
    report = build_experiment_report(jobs)
    assert report["funnel"]["discovery_signal_accepted"] >= 1
    assert report["funnel"]["target_url_indexed"] == 1
    assert report["funnel"]["discovery_signal_accepted"] != report["funnel"]["target_url_indexed"]
    days = {row["day"] for row in report["cumulative_verified_index_rate"]}
    assert days == {0, 1, 3, 7, 14}


def test_experiment_verify_schedule_is_not_hourly():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    job = SimpleNamespace(
        experiment_started_at=start,
        experiment_checkpoint="T+0",
        discovery_status="DISCOVERY_PUBLISHED",
        pipeline_status=PipelineStatus.RETRY_PENDING.value,
        attempt_count=1,
        submitted_at=start,
    )
    waiting = experiment_verify_action(job, now=start + timedelta(hours=1))
    assert waiting.action == "wait"
    due = experiment_verify_action(job, now=start + timedelta(hours=6, minutes=1))
    assert due.name == "T+6h"
    assert due.action == "verify"
    job.experiment_checkpoint = "T+7d"
    final = experiment_verify_action(job, now=start + timedelta(days=14))
    assert final.action == "final"


@pytest.mark.anyio
async def test_cse_hit_is_too_weak_to_claim_indexed():
    async def fetch(_url: str):
        return 200, '{"items": [{"link": "https://ex.com/x"}]}', None

    strategy = CustomSearchStrategy(api_key="k", cx="cx", fetch=fetch)
    raw = await strategy.verify("https://ex.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert raw is not None
    assert raw.status == VisibilityStatus.INDEXED.value
    classified = await IndexVerificationService([strategy]).verify(
        "https://ex.com/x",
        property_type=PropertyType.THIRD_PARTY_BACKLINK,
    )
    assert classified.status == VisibilityStatus.UNKNOWN.value


def _url_for_group(letter: str) -> str:
    for i in range(400):
        url = f"https://src.example/post?g={i}"
        fp = url_fingerprint(normalise_url(url) or url)
        if assign_experiment_group(fp) == letter:
            return url
    raise AssertionError(f"no URL mapped to group {letter}")


@pytest.mark.anyio
async def test_group_a_control_sends_no_discovery_signal(session):
    unknown = VerificationResult(
        status=VisibilityStatus.UNKNOWN.value,
        confidence=0.0,
        checked_at=datetime.now(timezone.utc),
        method="none",
        evidence="no evidence",
    )
    engine = IndexingEngine(
        session,
        verifier=IndexVerificationService([ManualVerificationStrategy(unknown)]),
        transport=live_pages(),
    )
    url = _url_for_group("A")
    job = await engine.submit(TENANT, url, target_url="https://ours.example/")
    assert job.experiment_group == "A"
    assert job.public_listed is False
    assert job.discovery_status == "CONTROL_MONITOR_ONLY"
    assert job.visibility_status != VisibilityStatus.INDEXED.value
    assert job.baseline_status in {"ELIGIBLE", "INELIGIBLE"}
    assert job.experiment_started_at is not None


@pytest.mark.anyio
async def test_experiment_api_starts_inconclusive(client, auth_headers):
    dash = await client.get("/api/indexing/engine/experiment", headers=auth_headers)
    assert dash.status_code == 200
    body = dash.json()
    assert body["verdict"]["answer"] == "INCONCLUSIVE"
    export = await client.get("/api/indexing/engine/experiment/export.json", headers=auth_headers)
    assert export.status_code == 200
    assert "items" in export.json()
    csv_res = await client.get("/api/indexing/engine/experiment/export.csv", headers=auth_headers)
    assert csv_res.status_code == 200
    assert "url" in csv_res.text
    bad = await client.post(
        "/api/indexing/engine/experiment/enroll",
        headers=auth_headers,
        json={"urls": [], "target_url": "https://ours.example/"},
    )
    assert bad.status_code == 400
