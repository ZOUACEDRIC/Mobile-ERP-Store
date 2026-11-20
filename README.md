# Mobile ERP Store

A mobile-first, offline-capable ERP for small and medium-sized stores. The intended first market is Cameroon, with XAF as the default currency; the data model remains configurable for other markets.

## Current status

This repository is still an early product foundation, **not a production-ready ERP**. The Neon PostgreSQL project and initial multi-tenant schema have been provisioned. The schema covers organizations and membership roles, stores, products and categories, stock movements, customers, suppliers, purchases, sales, expenses and audit logs. A current-stock view is also available.

The application itself is not yet connected to Neon. The repository still needs a complete responsive UI/PWA, real sign-in and session handling, server-side authorization, offline data sync, transactional business workflows, tests, and deployment. The existing C++/SQLite experiment is not the production persistence layer.

## Database

The initial migration is in [database/migrations/202611200001_initial_neon_erp.sql](database/migrations/202611200001_initial_neon_erp.sql).

Core design decisions:
- Every business record is scoped to an organization.
- Membership roles are constrained to owner, admin, manager, cashier, stock clerk and viewer.
- Monetary amounts use fixed-precision numeric columns, with XAF as the default organization currency.
- Stock is represented as an append-only movement ledger; `current_stock` is a read view over those movements.
- Neon Managed Auth is provisioned for user identity. The application must still enforce membership and role permissions on every server operation.

Do not connect a browser directly to the database or expose a database URL. Add the connection only to a trusted server environment.

## Planned end-to-end workflows

1. Create a business, invite staff and assign roles.
2. Set up stores, categories and products.
3. Receive purchases and record stock movements.
4. Complete sales, issue receipts and deduct stock atomically.
5. Record expenses, losses, returns and adjustments with audit history.
6. Produce stock, sales, margin and expense reports.
7. Work offline on mobile and sync safely when connectivity returns.
8. Export and restore business data.

## Development priorities

- Build a mobile-first responsive PWA with accessible navigation and clear loading, empty and error states.
- Implement transactional sales and purchase workflows; never update stock without a corresponding movement.
- Enforce tenant isolation and role permissions on the server.
- Add idempotency for sync and sale submission, conflict handling, and audit trails.
- Add automated tests for stock arithmetic, totals, concurrency, authorization and offline recovery.
- Add backup/export, privacy documentation and operational monitoring before launch.

Until those workflows pass end-to-end tests, do not describe the product as operational or production-ready.
