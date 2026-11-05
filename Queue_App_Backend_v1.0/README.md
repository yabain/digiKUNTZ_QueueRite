# Queue App Backend (baseline V1)

NestJS 10 / TypeScript / Mongoose. Local LAN API; MongoDB must run as a replica set (`rs0`) because ticket issuance uses multi-document transactions.

## Run
1. Copy `.env.example` to `.env` and set `MONGODB_URI`.
2. `npm install`
3. `npm run build`
4. `npm run start:dev`

Seed admin: `ADMIN_PASSWORD='a-long-secret' node scripts/seed-admin.js` after MongoDB is ready.
API prefix `/api`; health `/api/health`; login `/api/auth/login`.

## Important implementation notes
- Ticket creation requires an `Idempotency-Key` header and uses a MongoDB transaction.
- `call-next` uses atomic `findOneAndUpdate` sorted by `createdAt,_id`.
- Generic CRUD endpoints live under `/api/resources/:entity`.
- This release is a runnable implementation baseline, not a production certification. Before production, add automated RBAC matrix tests, signed offline licensing, hardened Socket.IO session verification, media upload validation/storage, orchestrated backup/restore, signed update packages, and hardware printer qualification.
