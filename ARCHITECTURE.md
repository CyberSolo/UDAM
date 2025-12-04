# UDAM Technical Architecture

## System Overview

UDAM is a three-tier application designed for scalability, security, and developer-friendliness.

## Components

### 1. Backend (Node.js + Express)

**Location:** `/backend`

**Key Features:**
- RESTful API architecture
- Session-based authentication
- Row-level locking for concurrency control
- AES-256 encryption for sensitive data
- Stripe webhook integration

**Critical Modules:**

```
backend/
├── src/
│   ├── server.js           # Main application entry
│   ├── routes/             # API endpoints
│   │   ├── auth.js         # Authentication
│   │   ├── listings.js     # Marketplace listings
│   │   ├── orders.js       # Purchase orders
│   │   └── tokens.js       # Token management
│   ├── db/                 # Database layer
│   └── middleware/         # Auth, CORS, etc.
└── migrations/             # SQL schema migrations
```

### 2. Frontend (Next.js)

**Location:** `/frontend`

**Architecture:**
- Server-side rendering (SSR) capable
- API-first design (consumes backend REST API)
- Minimal styling (intentionally barebones)
- Session management via HTTP-only cookies

**Pages:**
- `/` - Home/navigation
- `/login` - Authentication
- `/listings` - Browse marketplace
- `/sell` - Create new listing
- `/tokens` - View purchased tokens
- `/orders/success` - Payment success
- `/orders/cancel` - Payment cancelled

### 3. Database (PostgreSQL)

**Schema Design:**

```sql
users
├── id (PRIMARY KEY)
├── email
├── oauth_provider
└── created_at

sessions
├── id (PRIMARY KEY)
├── user_id (FOREIGN KEY)
├── session_token (UNIQUE)
├── expires_at
└── created_at

listings
├── id (PRIMARY KEY)
├── seller_id (FOREIGN KEY → users)
├── service_name
├── encrypted_api_key (AES-256)
├── price_per_unit
├── unit_description
├── available_units
├── status (active/sold_out)
└── created_at

orders
├── id (PRIMARY KEY)
├── buyer_id (FOREIGN KEY → users)
├── listing_id (FOREIGN KEY → listings)
├── units_requested
├── total_price
├── payment_status
├── stripe_checkout_session_id
├── payment_requires_confirmation
└── created_at

tokens
├── id (PRIMARY KEY)
├── buyer_id (FOREIGN KEY → users)
├── listing_id (FOREIGN KEY → listings)
├── order_id (FOREIGN KEY → orders)
├── encrypted_access_token (AES-256)
└── created_at
```

## Security Architecture

### 1. Token Encryption

**Algorithm:** AES-256-GCM

```javascript
// Tokens are encrypted before storage
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = cipher.update(apiKey, 'utf8', 'hex') + cipher.final('hex');
```

**Key Management:**
- Master key stored in environment variable
- Per-token initialization vectors (IV)
- Authentication tags for integrity verification

### 2. Session Management

**Flow:**
1. User logs in with email + OAuth provider
2. Server creates session with secure random token
3. Token stored in HTTP-only cookie
4. Session expires after configurable period
5. Logout revokes session immediately

**Security Features:**
- Secure session tokens (cryptographically random)
- HTTP-only cookies (prevents XSS)
- Session expiration
- Logout revocation

### 3. Payment Security

**Stripe Integration:**
- Server-side checkout session creation
- Webhook signature verification
- Idempotent order processing
- Secure credential storage

## Concurrency Control

### Problem: Race Conditions

Multiple buyers attempting to purchase the last unit simultaneously could cause overselling.

### Solution: Row-Level Locking

```sql
BEGIN;

-- Lock the listing row for update
SELECT * FROM listings 
WHERE id = $1 
FOR UPDATE;

-- Check availability
IF available_units >= units_requested THEN
  -- Decrement units
  UPDATE listings 
  SET available_units = available_units - units_requested
  WHERE id = $1;
  
  -- Create order
  INSERT INTO orders ...;
END IF;

COMMIT;
```

**Benefits:**
- Prevents overselling
- ACID compliance
- Minimal performance impact

## Deployment Architecture

### Development

```
localhost:3000 (Frontend) → localhost:4000 (Backend) → localhost:5432 (PostgreSQL)
```

### Production (Recommended)

```
[CDN/Load Balancer]
        ↓
[Frontend Instances] → [Backend Instances] → [PostgreSQL Primary]
        ↓                     ↓                      ↓
   [Static Assets]      [Redis Cache]      [PostgreSQL Replica]
```

**Recommended Stack:**
- Frontend: Vercel, Netlify, or Cloudflare Pages
- Backend: AWS ECS, Google Cloud Run, or DigitalOcean App Platform
- Database: AWS RDS, Google Cloud SQL, or managed PostgreSQL
- Payments: Stripe (production keys)

## Performance Considerations

### Database Indexes

```sql
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_tokens_buyer ON tokens(buyer_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
```

### Caching Strategy

**Recommended:**
- Cache listing data (frequently browsed)
- Cache user sessions (Redis)
- CDN for frontend assets

### Scaling

**Horizontal Scaling:**
- Stateless backend (multiple instances behind load balancer)
- Database connection pooling
- Session store in Redis (if scaling beyond single instance)

**Vertical Scaling:**
- Database resources (CPU, RAM)
- Backend instance size

## Testing Strategy

### CI/CD Pipeline

```yaml
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Start PostgreSQL service
5. Run migrations
6. Start backend
7. Execute E2E tests:
   - Health check
   - User login
   - Create listing
   - Purchase flow
   - Token issuance
   - Session revocation
   - Concurrency testing
```

### Test Coverage

- ✅ Authentication flow
- ✅ Listing creation
- ✅ Order processing (instant + Stripe)
- ✅ Token encryption/decryption
- ✅ Session management
- ✅ Race condition handling
- ✅ Payment webhooks (dev mode)

## Monitoring & Observability

### Recommended Metrics

**Backend:**
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database query time
- Active sessions

**Database:**
- Connection pool utilization
- Query performance
- Lock contention
- Storage usage

**Business:**
- Listings created
- Orders processed
- Payment success rate
- Revenue (total_price aggregations)

### Health Checks

```bash
# Basic health
GET /healthz

# Database connectivity
SELECT 1;

# Stripe connectivity (if configured)
stripe.customers.list({ limit: 1 });
```

## Future Architecture Considerations

### Potential Enhancements

1. **Microservices Split**
   - Auth service
   - Listing service
   - Order service
   - Payment service

2. **Event-Driven Architecture**
   - Message queue (RabbitMQ, Kafka)
   - Async order processing
   - Webhook retry logic

3. **GraphQL API**
   - Alternative to REST
   - Flexible queries
   - Real-time subscriptions

4. **Multi-tenancy**
   - Separate marketplaces
   - White-label support
   - Tenant isolation

## Contributing to Architecture

When proposing architectural changes:

1. Open an issue describing the problem
2. Discuss trade-offs (performance, complexity, cost)
3. Provide implementation plan
4. Consider backward compatibility
5. Update documentation

---

**Questions about architecture?** Open a GitHub discussion!