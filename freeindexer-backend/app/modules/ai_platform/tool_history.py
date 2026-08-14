"""Structured history records for tool executions."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class ToolExecutionRecord:
    tool: str
    input_data: Dict[str, Any] = field(default_factory=dict)
    status: str = "ok"
    result: Dict[str, Any] = field(default_factory=dict)


class ToolHistory:
    """Stores an in-memory execution history for enterprise observability."""

    def __init__(self) -> None:
        self.records: List[ToolExecutionRecord] = []

    def append(self, record: ToolExecutionRecord) -> None:
        self.records.append(record)

    def list(self) -> List[ToolExecutionRecord]:
        return list(self.records)
