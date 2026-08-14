"""Async repository layer for observability persistence models."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.observability.models import (
    Alert,
    ComplianceReport,
    Diagnostic,
    GovernancePolicy,
    HealthCheck,
    Incident,
    SecurityEvent,
    TraceRecord,
)
from app.repositories.base import BaseRepository


class IncidentRepository(BaseRepository[Incident]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Incident, session)


class AlertRepository(BaseRepository[Alert]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Alert, session)


class TraceRepository(BaseRepository[TraceRecord]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(TraceRecord, session)


class DiagnosticRepository(BaseRepository[Diagnostic]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Diagnostic, session)


class GovernancePolicyRepository(BaseRepository[GovernancePolicy]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(GovernancePolicy, session)


class ComplianceReportRepository(BaseRepository[ComplianceReport]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ComplianceReport, session)


class SecurityEventRepository(BaseRepository[SecurityEvent]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SecurityEvent, session)


class HealthCheckRepository(BaseRepository[HealthCheck]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(HealthCheck, session)
