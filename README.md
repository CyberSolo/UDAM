# Unified Data Marketplace (UDAM)

Minimal run instructions for local development.

## Prerequisites

- Node.js 18+
- Docker (optional, for local Postgres)
- Stripe account (optional, for real checkout)

## Setup

- Install dependencies
  - `cd frontend && npm install`
  - `cd backend && npm install`

- Start Postgres (Docker)
  - `docker run --name udam-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`

- Backend environment
  - `SESSION_SECRET` any non-empty string
  - `MARKETPLACE_MASTER_KEY` 64 hex chars (AES-256 key)
  - `DATABASE_URL` e.g. `postgres://postgres:postgres@localhost:5432/postgres`
  - `SMALL_LIMIT` e.g. `5` (orders ≤ limit auto-issue tokens)
  - `FRONTEND_ORIGIN` default `http://localhost:3000`
  - Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUCCESS_URL`, `CANCEL_URL`, `BACKEND_PUBLIC_URL`

- Start backend
  - Example:
    - `SESSION_SECRET=devsecret MARKETPLACE_MASTER_KEY=0000000000000000000000000000000000000000000000000000000000000000 SMALL_LIMIT=5 DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run dev`

- Frontend environment
  - Copy `frontend/.env.local.example` to `.env.local`
  - Set `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`

- Start frontend
  - `npm run dev` in `frontend`
  - Open `http://localhost:3000/`

## Usage

- Login: enter email and provider
- Create listing: provide service name, API key, price, unit description, available units
- Buy:
  - If total ≤ `SMALL_LIMIT`: tokens issued instantly and visible on `My Tokens`
  - If Stripe not configured and total > `SMALL_LIMIT`: use dev confirm URL `/orders/dev/confirm/:order_id` to finalize
  - If Stripe configured: follow Checkout and webhook will issue tokens

## Notes

- Do not commit real secrets or local database data
- See `backend/.env.example` and `frontend/.env.local.example` for environment variables
- Health check: `GET http://localhost:4000/healthz`
