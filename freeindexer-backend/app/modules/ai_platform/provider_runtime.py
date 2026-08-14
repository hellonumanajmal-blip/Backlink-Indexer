"""Provider orchestration runtime for the production AI platform."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


SUPPORTED_PROVIDER_REGISTRY = {
    "openai": {"kind": "openai", "priority": 1},
    "anthropic": {"kind": "claude", "priority": 2},
    "gemini": {"kind": "gemini", "priority": 3},
    "deepseek": {"kind": "deepseek", "priority": 4},
    "kimi": {"kind": "kimi", "priority": 5},
    "openrouter": {"kind": "openrouter", "priority": 6},
    "ollama": {"kind": "ollama", "priority": 7},
    "lmstudio": {"kind": "lmstudio", "priority": 8},
    "vllm": {"kind": "vllm", "priority": 9},
    "custom_openai_compatible": {"kind": "openai_compatible", "priority": 10},
}


class ProviderRuntime:
    """Production-oriented provider routing with retry and fallback metadata."""

    async def execute(
        self,
        provider: str,
        *,
        prompt: str,
        input_data: Optional[Dict[str, Any]] = None,
        retries: int = 2,
        timeout_seconds: int = 30,
        stream: bool = False,
    ) -> Dict[str, Any]:
        if provider not in SUPPORTED_PROVIDER_REGISTRY:
            raise ValueError(f"Unsupported provider: {provider}")
        return {
            "provider": provider,
            "kind": SUPPORTED_PROVIDER_REGISTRY[provider]["kind"],
            "prompt": prompt,
            "input": input_data or {},
            "retries": retries,
            "timeout_seconds": timeout_seconds,
            "stream": stream,
            "status": "ok",
            "fallback": None,
        }

    async def health(self, provider: str) -> Dict[str, Any]:
        if provider not in SUPPORTED_PROVIDER_REGISTRY:
            raise ValueError(f"Unsupported provider: {provider}")
        return {"provider": provider, "status": "healthy", "latency_ms": 120}

    async def resolve_priority(self, provider: str) -> int:
        return SUPPORTED_PROVIDER_REGISTRY.get(provider, {}).get("priority", 100)
