"""Document ingestion and normalization utilities for the knowledge platform."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class DocumentProcessor:
    """Normalizes inbound document payloads across multiple supported formats."""

    SUPPORTED_FORMATS = {
        "pdf",
        "docx",
        "markdown",
        "html",
        "csv",
        "json",
        "xml",
        "rss",
        "sitemap",
        "webpage",
    }

    async def normalize(self, document: Dict[str, Any]) -> Dict[str, Any]:
        content = str(document.get("content_text") or document.get("content") or "")
        document_type = str(document.get("document_type") or "markdown")
        if document_type not in self.SUPPORTED_FORMATS:
            document_type = "markdown"
        return {
            "title": document.get("title") or "Untitled document",
            "document_type": document_type,
            "source_uri": document.get("source_uri"),
            "content_text": content,
            "metadata": {
                "language": document.get("language") or "en",
                "deduplicated": bool(document.get("deduplicated")),
                "ocr_ready": bool(document.get("ocr_ready")),
                "incremental": bool(document.get("incremental")),
            },
        }

    async def extract_metadata(self, document: Dict[str, Any]) -> Dict[str, Any]:
        normalized = await self.normalize(document)
        return normalized["metadata"]

    async def detect_language(self, content: str) -> str:
        return "en" if content else "unknown"

    async def deduplicate(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen: Dict[str, Dict[str, Any]] = {}
        for document in documents:
            key = document.get("source_uri") or document.get("title") or document.get("content_text")
            seen[key] = document
        return list(seen.values())
