from __future__ import annotations

import time
from typing import Any

import httpx


class ApiError(Exception):
    def __init__(self, message: str, status: int, request_id: str | None = None):
        super().__init__(message)
        self.status = status
        self.request_id = request_id


class PintDownClient:
    def __init__(self, base_url: str, api_token: str, max_retries: int = 3):
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.max_retries = max_retries
        self.backlinks = _Backlinks(self)
        self.projects = _Projects(self)

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.api_token}"
        attempt = 0
        while True:
            with httpx.Client(timeout=30.0) as client:
                res = client.request(method, f"{self.base_url}{path}", headers=headers, **kwargs)
            rid = res.headers.get("X-Request-Id")
            if res.is_success:
                return res.json()
            if res.status_code in (429, 500, 502, 503) and attempt < self.max_retries:
                attempt += 1
                time.sleep(0.2 * (2**attempt))
                continue
            raise ApiError(res.text, res.status_code, rid)


class _Backlinks:
    def __init__(self, client: PintDownClient):
        self._c = client

    def list(self, page: int = 1, page_size: int = 25, platform: str | None = None) -> dict:
        params: dict[str, Any] = {"page": page, "page_size": page_size}
        if platform:
            params["platform"] = platform
        return self._c.request("GET", "/api/v1/backlinks", params=params)


class _Projects:
    def __init__(self, client: PintDownClient):
        self._c = client

    def list(self) -> dict:
        return self._c.request("GET", "/api/v1/projects")
