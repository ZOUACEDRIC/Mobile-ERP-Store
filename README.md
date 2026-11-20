# StorePilot ERP

StorePilot is a mobile-first store operations platform designed for small and medium-sized retailers. XAF is the default currency and Cameroon is the initial market, while each workspace can select its own currency and timezone.

## What is in this branch

This branch introduces the first web application foundation:
- Responsive dashboard and mobile navigation.
- Neon Managed Auth sign-in and sign-up.
- Multi-tenant business workspace onboarding.
- Product catalogue and stock visibility.
- Stock receiving, transactional point-of-sale and expense entry.
- Server-side organization membership and role checks.
- Neon PostgreSQL persistence using a pooled server-side connection.
- Installable PWA manifest and application icon.

The API keeps the database URL on the server. Sales are committed in a transaction: the receipt, sale lines and stock movements either all succeed or all roll back. The app checks available stock while holding a transaction-level advisory lock for the store.

## Important current limitations

This is a foundation, not yet a production-ready ERP. Before launch it still needs:
- CI verification and real Neon environment configuration.
- End-to-end sign-up/sign-in and account-isolation tests.
- Supplier management, purchase order lifecycle, returns, refunds, discounts, tax rules, staff invitations and fine-grained permission management.
- Offline-first local storage and conflict-safe sync (the PWA manifest alone does not mean offline mode is implemented).
- Audit-log writes, export/restore, automated backups, monitoring and production security review.
- Full receipt printing and accounting reports.

Do not process real business transactions until the test and security checklist passes.

## Neon setup

The initial database schema is in `database/migrations/202611200001_initial_neon_erp.sql`. The Neon project has Managed Auth provisioned and the base schema is applied.

Configure these server-only environment variables in local development and deployment:
- `DATABASE_URL`: pooled PostgreSQL connection string for the Mobile ERP Neon project.
- `NEON_AUTH_BASE_URL`: the branch-specific Managed Auth URL.
- `NEON_AUTH_COOKIE_SECRET`: random secret of at least 32 characters (generate using `openssl rand -base64 32`).

Never commit real credentials or expose them through `NEXT_PUBLIC_` variables.

## Run locally

1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add your private Neon connection string and cookie secret.
4. Run `npm run dev` and open http://localhost:3000.

## Database model

The PostgreSQL schema is organization-scoped. It includes organizations, memberships and roles, stores, products, categories, customers, suppliers, sales, sale lines, purchases, purchase lines, stock movements, expenses and audit logs. Stock is represented by an append-only movement ledger, with `current_stock` as a read view.

## Safety and integrity

- Every API resolves the signed-in identity on the server.
- Organization membership is checked before business data is read or changed.
- Product, sales, purchase and expense operations use parameterized SQL.
- Sales are atomic and prevent checkout beyond recorded available stock.
- The browser never receives the database connection string.

The existing C++/SQLite experiment remains in `database/` as a separate learning artifact; it is not the web app's persistence layer.
