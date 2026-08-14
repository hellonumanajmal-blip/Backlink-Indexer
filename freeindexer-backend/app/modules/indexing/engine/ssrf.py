"""SSRF guards for every outbound fetch (probe, robots, redirects, canonical).

Never fetch localhost, private, link-local, or cloud metadata addresses.
The original hostname is not trusted after a redirect — each hop is re-checked.
"""
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

BLOCKED_HOSTS = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata.google.com",
    "metadata",
    "internal",
}

BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".corp", ".lan", ".home")

METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("169.254.170.2"),
}


@dataclass(frozen=True, slots=True)
class SsrfVerdict:
    ok: bool
    error: Optional[str] = None
    hostname: Optional[str] = None


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().strip(".")


def hostname_blocked(host: str) -> Optional[str]:
    if not host:
        return "missing hostname"
    if host in BLOCKED_HOSTS:
        return f"blocked hostname {host}"
    if any(host.endswith(suf) for suf in BLOCKED_SUFFIXES):
        return f"blocked hostname suffix {host}"
    if host == "0.0.0.0" or host == "::" or host == "[::]":
        return "blocked unspecified address"
    try:
        ip = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return None
    return _ip_blocked(ip)


def _ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> Optional[str]:
    if ip in METADATA_IPS:
        return f"blocked metadata address {ip}"
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
        return f"blocked non-public address {ip}"
    if ip.is_unspecified:
        return f"blocked unspecified address {ip}"
    return None


def resolve_blocked(host: str) -> Optional[str]:
    """DNS resolution check. Call only for real network fetches, not mock transports.

    NXDOMAIN is not SSRF — the HTTP client reports CLASS_DNS. We only block when
    resolution succeeds and points at a non-public address.
    """
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return None
    for info in infos:
        sockaddr = info[4]
        if not sockaddr:
            continue
        try:
            ip = ipaddress.ip_address(sockaddr[0])
        except ValueError:
            continue
        reason = _ip_blocked(ip)
        if reason:
            return reason
    return None


def inspect_url(url: str, *, resolve_dns: bool = False) -> SsrfVerdict:
    parsed = urlparse((url or "").strip())
    scheme = (parsed.scheme or "").lower()
    if scheme not in {"http", "https"}:
        return SsrfVerdict(False, "only HTTP/HTTPS URLs may be fetched", parsed.hostname)
    host = _host(url)
    reason = hostname_blocked(host)
    if reason:
        return SsrfVerdict(False, reason, host)
    if resolve_dns and host:
        reason = resolve_blocked(host)
        if reason:
            return SsrfVerdict(False, reason, host)
    return SsrfVerdict(True, None, host)


def inspect_redirect_target(base_url: str, location: str, *, resolve_dns: bool = False) -> SsrfVerdict:
    if not location:
        return SsrfVerdict(False, "empty redirect Location")
    absolute = urljoin(base_url, location)
    return inspect_url(absolute, resolve_dns=resolve_dns)


__all__ = ["SsrfVerdict", "inspect_url", "inspect_redirect_target", "hostname_blocked"]
