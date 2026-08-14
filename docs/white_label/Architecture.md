# Phase 26 Enterprise White-Label Platform, Client Portal & Executive Reporting Architecture

## Overview

Phase 26 provides a multi-tenant White-Label Platform enabling agencies and enterprise clients to manage custom branding, client workspaces, client portals, and scheduled executive reports across all system capabilities (SEO, Indexing, Backlinks, Outreach, Analytics).

## Architecture Modules

1. **Brand Management (`BrandingManager`)**:
   - Configures logo assets, custom CSS design tokens (`--brand-primary`, `--brand-secondary`, `--brand-font-family`), and white-label email/report footers.
2. **Client Workspaces (`WorkspaceManager`)**:
   - Manages client workspaces, member role permissions (`AgencyAdmin`, `ClientAdmin`, `ClientViewer`), and multi-tenant data boundaries.
3. **Client Portal Engine (`ClientPortalManager`)**:
   - Renders white-label client portal `/portal` aggregating SEO health scores, index coverage, active outreach campaigns, and downloadable executive reports.
4. **Executive Reporting & AI Summaries (`ReportManager`)**:
   - Generates 10 executive report types across PDF, CSV, Excel, JSON, and ZIP packages.
   - Embeds natural language AI summaries separating measured metrics from strategic recommendations.
5. **Background Workers (`tasks.py`)**:
   - Celery workers executing report scheduling, PDF/ZIP rendering, email notifications, and session cleanup.
