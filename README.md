# Mobile ERP Store

An early prototype for an AI-assisted ERP system for small and medium-sized stores.

## Current repository status

**This is not yet a complete ERP product.** The repository currently contains:
- A small C++/SQLite database experiment under `database/`
- Module folders for staff, sales, maintenance, stocks, losses, vouchers and complaints, with mostly placeholder documentation
- No complete mobile/web user interface, authentication, role/permission system, operational inventory workflow, sales workflow or production deployment

The database sample currently demonstrates opening a SQLite database. It is not a complete persistence layer or a finished ERP backend.

## Recommended next engineering phase

Before expanding features, define the target users and core workflow. Then build and test one vertical slice end to end:
1. Store and staff setup with role-based access
2. Product catalogue and stock movements
3. Sales and receipts
4. Purchase and supplier records
5. Losses/adjustments with an audit trail
6. Reporting and backups

Do not describe this repository as production-ready or as a functioning AI-powered ERP until those workflows are implemented, secured and tested.

## Development

The current database prototype is under `database/`. Its Makefile and SQLite build should be treated as experimental until a clean CI build is added.
