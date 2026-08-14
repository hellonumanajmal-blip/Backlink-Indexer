# Phase 2 Database and Authentication Architecture

## 1. Database Architecture
The Phase 2 backend replaces the temporary in-memory storage with PostgreSQL-backed SQLAlchemy models for:
- users
- sessions
- projects
- campaigns
- backlinks

Each entity uses:
- UUID or integer primary keys
- created_at and updated_at timestamps
- foreign keys and relationships
- soft-delete support where appropriate

## 2. Authentication Flow
The platform supports:
- email registration
- email/password login
- secure session cookies
- logout
- current-user lookup

OAuth is prepared for later, but not implemented in this phase.

## 3. Session Strategy
Sessions are stored in the database and linked to users. The session token is persisted securely and invalidated on logout.

## 4. Repository Pattern
Database access is moved behind repository classes for:
- user repository
- session repository
- project repository
- campaign repository
- backlink repository
- dashboard summary repository

## 5. Service Layer
Business logic stays in services to enforce:
- validation
- ownership
- duplicate checks
- transaction boundaries
- consistent error handling

## 6. DTO Layer
Request/response contracts are defined separately from ORM models so the API remains stable and decoupled from persistence.

## 7. Entity Relationships
- User -> Projects
- Project -> Campaigns
- Campaign -> Backlinks
- Session -> User

## 8. Folder Structure
- backend/app/modules/authentication/
- backend/app/modules/projects/
- backend/app/modules/campaigns/
- backend/app/modules/backlinks/
- backend/app/modules/shared/

## 9. API Compatibility
Existing Phase 1 routes remain available. Phase 2 adds:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

## 10. Migration Strategy
Alembic manages schema evolution from the initial foundation into the persistent model layer.

## 11. Security Considerations
- password hashing
- secure session cookies
- rate limiting for auth endpoints
- input validation
- ownership checks

## 12. Testing Strategy
Backend tests cover registration, login, logout, repositories, services, and API behaviors.
