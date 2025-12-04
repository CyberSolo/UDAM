# 🚀 Unified Data Marketplace (UDAM)

> **An open-source, API-first data marketplace backend** — Monetize your data services, APIs, or datasets with built-in payments, token management, and secure access control.

[![CI](https://github.com/data-agent-marketplace/data-agent-marketplace/actions/workflows/ci.yml/badge.svg)](https://github.com/data-agent-marketplace/data-agent-marketplace/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Why UDAM?

Building a data marketplace from scratch is complex. UDAM provides the essential backend infrastructure so you can focus on your data services:

- ✅ **Ready-to-use API** for listings, orders, and token management
- ✅ **Stripe integration** for payments (or instant tokens for small orders)
- ✅ **Secure token encryption** with AES-256
- ✅ **Concurrency-safe** order processing with PostgreSQL row locks
- ✅ **Session-based auth** with OAuth provider support
- ✅ **CI/CD tested** with comprehensive E2E tests

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Backend    │─────▶│  PostgreSQL │
│  (Next.js)  │      │  (Node.js)   │      │   Database  │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    Stripe    │
                     │   Payments   │
                     └──────────────┘
```

**Tech Stack:**
- Backend: Node.js + Express
- Frontend: Next.js (minimal UI, bring your own design)
- Database: PostgreSQL 16
- Payments: Stripe Checkout
- Deployment: Docker-ready

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (or Docker)
- Stripe account (optional, for payments)

### 1. Clone and Install

```bash
git clone https://github.com/data-agent-marketplace/data-agent-marketplace.git
cd data-agent-marketplace

# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 2. Start PostgreSQL

```bash
docker run --name udam-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:16
```

### 3. Configure Backend

```bash
cd backend

# Required environment variables
export SESSION_SECRET="your-secret-key"
export MARKETPLACE_MASTER_KEY="0000000000000000000000000000000000000000000000000000000000000000"
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"
export SMALL_LIMIT=5
export FRONTEND_ORIGIN="http://localhost:3000"

# Optional: Stripe integration
# export STRIPE_SECRET_KEY="sk_test_..."
# export STRIPE_WEBHOOK_SECRET="whsec_..."

npm run dev
```

### 4. Start Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local: NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

npm run dev
```

Visit `http://localhost:3000` 🎉

## 📖 Core Features

### For Data Sellers
- **Create Listings**: Name your service, set pricing, define available units
- **API Key Management**: Securely store and encrypt service credentials
- **Automated Token Issuance**: Buyers receive encrypted access tokens automatically

### For Data Buyers
- **Browse Marketplace**: Discover available data services
- **Instant Purchases**: Small orders (≤ SMALL_LIMIT) issue tokens immediately
- **Stripe Checkout**: Larger orders use secure Stripe payment flow
- **Token Management**: View and manage purchased access tokens

### System Features
- **Concurrency Control**: Row-level locks prevent overselling
- **Session Management**: Secure authentication with revocable sessions
- **Health Checks**: `/healthz` endpoint for monitoring
- **Comprehensive Testing**: E2E tests for critical flows

## 🔧 Configuration

### Backend Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Secret for session encryption |
| `MARKETPLACE_MASTER_KEY` | Yes | 64-char hex key for AES-256 token encryption |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SMALL_LIMIT` | Yes | Max order value for instant token issuance |
| `FRONTEND_ORIGIN` | Yes | CORS origin (e.g., `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` | No | Stripe API key for payments |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `SUCCESS_URL` | No | Redirect after successful payment |
| `CANCEL_URL` | No | Redirect after cancelled payment |
| `BACKEND_PUBLIC_URL` | No | Public URL for Stripe webhooks |

### Frontend Environment Variables

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## 🧪 Testing

Run the full test suite:

```bash
# CI runs automatically on push/PR
npm test  # (if configured)

# Or manually run backend tests
cd backend
npm test
```

CI tests include:
- ✅ Build verification
- ✅ Health check
- ✅ E2E purchase flow (instant tokens)
- ✅ Logout/session revocation
- ✅ Concurrency lock testing (race conditions)

## 🔌 API Reference

### Authentication
- `POST /auth/login` - Create session (email + OAuth provider)
- `POST /auth/logout` - Revoke session

### Listings
- `GET /listings` - Browse all listings
- `GET /listings/:id` - Get listing details
- `POST /listings` - Create new listing (requires auth)

### Orders
- `POST /orders` - Create purchase order (requires auth)
- `GET /orders/dev/confirm/:id` - Dev mode: confirm order without Stripe

### Tokens
- `GET /tokens` - Get user's purchased tokens (requires auth)

### Health
- `GET /healthz` - Health check endpoint

## 🎨 Customization

UDAM ships with a **minimal frontend** — intentionally! This lets you:

1. **Bring your own UI framework**: React, Vue, Svelte, etc.
2. **Design your brand**: No opinionated styling to override
3. **Extend the API**: Add custom endpoints for your use case

The backend is designed to be framework-agnostic. Integrate with any frontend or use it as a pure API service.

## 🤝 Contributing

Contributions are welcome! Areas we'd love help with:

- 🎨 UI/UX improvements (templates, themes)
- 📚 Documentation and tutorials
- 🔒 Security enhancements
- 🌐 Internationalization
- 🧩 Integrations (more payment providers, auth methods)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with modern best practices for data marketplace infrastructure. Inspired by the need for open-source alternatives to proprietary data trading platforms.

---

**Questions?** Open an issue or start a discussion!

**Ready to customize?** Fork this repo and make it your own.