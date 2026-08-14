# Security Hardening Checklist

- [ ] TLS terminated at Ingress / load balancer
- [ ] `SESSION_SECRET` ≥ 32 chars; rotate quarterly
- [ ] `BACKUP_HMAC_SECRET` distinct from session secret
- [ ] Non-root containers (`runAsNonRoot`)
- [ ] Security headers present (HSTS, nosniff, frame deny)
- [ ] CSP recommended: `default-src 'self'` for admin UI (document per deploy)
- [ ] Dependency audit in CI (`pip-audit`)
- [ ] Container image scan (Trivy) on release
- [ ] Least privilege DB user (no SUPERUSER)
- [ ] Admin MFA via SSO when available
- [ ] Secrets only via env / K8s Secret — never in images
- [ ] Review `/api/operations/*` admin-only access
