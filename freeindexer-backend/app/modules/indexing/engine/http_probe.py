"""Honest HTTP probe used by validation, crawlability, and backlink checks.

Identifies itself as our crawler. It never spoofs Googlebot. A successful
fetch is recorded as OUR_CRAWLER_VISITED, never GOOGLEBOT_VISITED.
"""
from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import urljoin, urlparse

OUR_CRAWLER_UA = (
    "PintDownFreeIndexer/1.0 (+https://pintdown.site/bot; crawler=ours; not-Googlebot)"
)

CLASS_OK = "200_OK"
CLASS_REDIRECT = "3xx_redirect"
CLASS_4XX = "4xx"
CLASS_410 = "410_gone"
CLASS_5XX = "5xx"
CLASS_TIMEOUT = "timeout"
CLASS_DNS = "dns_failure"
CLASS_SSL = "ssl_error"
CLASS_INVALID = "invalid_url"
CLASS_EMPTY = "empty_response"
CLASS_INVALID_HTML = "invalid_html"
CLASS_ERROR = "network_error"
CLASS_SSRF = "ssrf_blocked"


@dataclass(slots=True)
class HttpProbeResult:
    requested_url: str
    ok: bool
    classification: str
    http_status: Optional[int] = None
    response_time_ms: int = 0
    content_type: Optional[str] = None
    content_length: Optional[int] = None
    final_url: Optional[str] = None
    redirect_chain: List[str] = field(default_factory=list)
    redirect_statuses: List[int] = field(default_factory=list)
    body: Optional[str] = None
    headers: dict = field(default_factory=dict)
    error: Optional[str] = None
    our_crawler_visited: bool = False

    @property
    def is_html(self) -> bool:
        ct = (self.content_type or "").lower()
        return "html" in ct or (self.body or "").lstrip().startswith(("<!", "<html", "<HTML"))


def classify_status(code: Optional[int], error_class: Optional[str] = None) -> str:
    if error_class:
        return error_class
    if code is None:
        return CLASS_ERROR
    if code == 200:
        return CLASS_OK
    if code == 410:
        return CLASS_410
    if 300 <= code < 400:
        return CLASS_REDIRECT
    if 400 <= code < 500:
        return CLASS_4XX
    if 500 <= code < 600:
        return CLASS_5XX
    return CLASS_ERROR


def _header(headers: dict, name: str) -> Optional[str]:
    lower = {str(k).lower(): v for k, v in headers.items()}
    value = lower.get(name.lower())
    if value is None:
        return None
    return str(value)


async def probe_url(
    url: str,
    *,
    timeout: float = 15.0,
    max_redirects: int = 8,
    method: str = "GET",
    user_agent: str = OUR_CRAWLER_UA,
    transport: Optional[object] = None,
) -> HttpProbeResult:
    """Fetch ``url`` and record accessibility. Never claims Google visited it."""
    try:
        import httpx
    except ImportError:
        return HttpProbeResult(
            requested_url=url,
            ok=False,
            classification=CLASS_ERROR,
            error="httpx is not installed; cannot perform outbound HTTP requests",
        )

    from app.modules.indexing.engine.ssrf import inspect_redirect_target, inspect_url

    resolve_dns = transport is None
    verdict = inspect_url(url, resolve_dns=resolve_dns)
    if not verdict.ok:
        return HttpProbeResult(
            requested_url=url,
            ok=False,
            classification=CLASS_SSRF,
            error=verdict.error or "SSRF blocked",
        )

    headers = {"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml,*/*"}
    started = __import__("time").perf_counter()
    # Follow redirects ourselves so every hop can be SSRF-checked.
    client_kwargs = {"timeout": timeout, "follow_redirects": False, "headers": headers}
    if transport is not None:
        client_kwargs["transport"] = transport

    limiter_cm = None
    if transport is None:
        from app.modules.indexing.engine.rate_limit import get_limiter

        limiter_cm = get_limiter().slot(url)
        await limiter_cm.__aenter__()

    try:
        async with httpx.AsyncClient(**client_kwargs) as client:
            current = url
            chain: List[str] = []
            redirect_statuses: List[int] = []
            response = None
            for _ in range(max_redirects + 1):
                response = await _send_with_retry_after(
                    client, method, current, transport_is_mock=transport is not None
                )
                code = response.status_code
                if 300 <= code < 400:
                    location = response.headers.get("location") or ""
                    hop_verdict = inspect_redirect_target(
                        current, location, resolve_dns=resolve_dns
                    )
                    if not hop_verdict.ok:
                        elapsed = int((__import__("time").perf_counter() - started) * 1000)
                        return HttpProbeResult(
                            requested_url=url,
                            ok=False,
                            classification=CLASS_SSRF,
                            http_status=code,
                            response_time_ms=elapsed,
                            redirect_chain=chain,
                            redirect_statuses=redirect_statuses,
                            error=hop_verdict.error or "SSRF blocked on redirect",
                            our_crawler_visited=True,
                        )
                    absolute = urljoin(current, location)
                    chain.append(absolute)
                    redirect_statuses.append(code)
                    current = absolute
                    continue
                break
            assert response is not None
            elapsed = int((__import__("time").perf_counter() - started) * 1000)
            body = ""
            if method.upper() != "HEAD":
                body = response.text[:500_000]
            ctype = response.headers.get("content-type")
            clen = response.headers.get("content-length")
            try:
                content_length = int(clen) if clen is not None else len(body.encode("utf-8", "ignore"))
            except ValueError:
                content_length = len(body.encode("utf-8", "ignore"))
            code = response.status_code
            if chain and 200 <= code < 300:
                classification = CLASS_OK
            else:
                classification = classify_status(code)
            stripped = (body or "").strip()
            if 200 <= code < 300 and not stripped:
                classification = CLASS_EMPTY
            elif (
                200 <= code < 300
                and ctype
                and "html" in ctype.lower()
                and stripped
                and "<" not in stripped[:2000]
            ):
                classification = CLASS_INVALID_HTML
            return HttpProbeResult(
                requested_url=url,
                ok=200 <= code < 300 and classification not in {CLASS_EMPTY, CLASS_INVALID_HTML},
                classification=classification,
                http_status=code,
                response_time_ms=elapsed,
                content_type=ctype,
                content_length=content_length,
                final_url=str(response.url) if not chain else current,
                redirect_chain=chain,
                redirect_statuses=redirect_statuses,
                body=body or None,
                headers={k: v for k, v in response.headers.items()},
                our_crawler_visited=True,
            )
    except Exception as exc:
        elapsed = int((__import__("time").perf_counter() - started) * 1000)
        classification, message = _classify_exception(exc)
        return HttpProbeResult(
            requested_url=url,
            ok=False,
            classification=classification,
            response_time_ms=elapsed,
            error=message,
            our_crawler_visited=False,
        )
    finally:
        if limiter_cm is not None:
            await limiter_cm.__aexit__(None, None, None)


async def _send_with_retry_after(client, method: str, url: str, *, transport_is_mock: bool):
    request = client.build_request(method, url)
    response = await client.send(request)
    if transport_is_mock or response.status_code != 429:
        return response
    from app.modules.indexing.engine.rate_limit import parse_retry_after

    wait = parse_retry_after(response.headers.get("Retry-After"))
    if wait <= 0:
        wait = min(5.0, 1.0 + random.uniform(0.1, 1.5))
    await asyncio.sleep(wait)
    request = client.build_request(method, url)
    return await client.send(request)


def _classify_exception(exc: BaseException) -> tuple[str, str]:
    name = type(exc).__name__
    text = f"{name}: {exc}"
    lowered = text.lower()
    if "timeout" in name.lower() or "timeout" in lowered:
        return CLASS_TIMEOUT, text
    if "ssl" in name.lower() or "certificate" in lowered or "tls" in lowered:
        return CLASS_SSL, text
    if "name or service not known" in lowered or "getaddrinfo" in lowered or "nodename" in lowered:
        return CLASS_DNS, text
    if "connecterror" in name.lower() or "dns" in lowered:
        return CLASS_DNS, text
    return CLASS_ERROR, text


def extract_canonical(html: str, base_url: str) -> Optional[str]:
    all_c = extract_all_canonicals(html, base_url)
    return all_c[0] if all_c else None


def extract_all_canonicals(html: str, base_url: str) -> List[str]:
    if not html:
        return []
    import re

    found: List[str] = []
    for match in re.finditer(r"<link\b[^>]*>", html, flags=re.IGNORECASE):
        tag = match.group(0)
        rel = _attr(tag, "rel")
        if rel and rel.lower() == "canonical":
            href = _attr(tag, "href")
            if href:
                found.append(urljoin(base_url, href.strip()))
    return found


def classify_canonical(page_url: str, canonicals: List[str], final_url: Optional[str] = None) -> str:
    """Return self | missing | multiple | CANONICAL_MISMATCH."""
    current = (final_url or page_url).rstrip("/")
    if not canonicals:
        return "missing"
    unique = []
    seen = set()
    for item in canonicals:
        key = item.rstrip("/")
        if key not in seen:
            seen.add(key)
            unique.append(item)
    if len(unique) > 1:
        return "multiple"
    canon = unique[0].rstrip("/")
    if canon == current:
        return "self"
    return "CANONICAL_MISMATCH"


def extract_meta_robots(html: str) -> Optional[str]:
    if not html:
        return None
    lowered = html.lower()
    search_from = 0
    while True:
        idx = lowered.find("name=", search_from)
        if idx < 0:
            return None
        window = html[idx : idx + 400]
        name = _attr(window, "name")
        if name and name.lower() == "robots":
            content = _attr(window, "content")
            return content
        search_from = idx + 5


def _attr(fragment: str, name: str) -> Optional[str]:
    import re

    match = re.search(
        rf"{name}\s*=\s*([\"'])(.*?)\1", fragment, flags=re.IGNORECASE | re.DOTALL
    )
    if match:
        return match.group(2).strip()
    match = re.search(rf"{name}\s*=\s*([^\s>]+)", fragment, flags=re.IGNORECASE)
    if match:
        return match.group(1).strip().strip("\"'")
    return None


def robots_url_for(page_url: str) -> str:
    parsed = urlparse(page_url)
    return f"{parsed.scheme}://{parsed.netloc}/robots.txt"


def same_host(a: str, b: str) -> bool:
    return (urlparse(a).hostname or "").lower() == (urlparse(b).hostname or "").lower()
