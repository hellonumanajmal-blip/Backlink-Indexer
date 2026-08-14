"""Provider management abstraction supporting pluggable multi-LLM providers."""
from __future__ import annotations

from typing import Any, Dict, List


class ProviderManager:
    """Registry of provider adapters; each provider is pluggable and isolated."""

    def __init__(self) -> None:
        self.providers: Dict[str, Dict[str, Any]] = {
            "openai": {"type": "openai", "enabled": True},
            "anthropic": {"type": "anthropic", "enabled": True},
            "gemini": {"type": "gemini", "enabled": True},
            "deepseek": {"type": "deepseek", "enabled": True},
            "qwen": {"type": "qwen", "enabled": True},
            "kimi": {"type": "kimi", "enabled": True},
            "grok": {"type": "grok", "enabled": True},
            "openrouter": {"type": "openrouter", "enabled": True},
            "ollama": {"type": "ollama", "enabled": True},
            "lmstudio": {"type": "lmstudio", "enabled": True},
            "custom_openai_compatible": {"type": "custom_openai_compatible", "enabled": True},
        }

    def list_providers(self) -> List[Dict[str, Any]]:
        return [
            {"name": name, **details}
            for name, details in self.providers.items()
        ]
