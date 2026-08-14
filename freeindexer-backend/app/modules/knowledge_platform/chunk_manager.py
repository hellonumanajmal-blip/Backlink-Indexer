"""Chunking service for enterprise knowledge ingestion."""
from __future__ import annotations

from typing import Any, Dict, List


class ChunkManager:
    """Deterministic chunking utility used by the knowledge pipeline."""

    async def chunk(self, content: str, chunk_size: int = 600, overlap: int = 120) -> List[Dict[str, Any]]:
        if not content:
            return []
        text = content.strip()
        chunks: List[Dict[str, Any]] = []
        start = 0
        index = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk_text = text[start:end]
            chunks.append(
                {
                    "chunk_index": index,
                    "content_text": chunk_text,
                    "token_count": max(1, len(chunk_text.split())),
                    "metadata": {"chunk_size": chunk_size, "overlap": overlap},
                }
            )
            index += 1
            start += max(1, chunk_size - overlap)
        return chunks

    async def merge(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return chunks
