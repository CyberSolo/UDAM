# Building a Production-Ready Data Marketplace: Architecture, Security, and Lessons Learned

After building three different data marketplaces over the past two years, I noticed a pattern: every project spent 4-6 weeks rebuilding the same infrastructure before we could focus on the actual product. Payment processing, token encryption, access control, concurrency handling - it's the same problems over and over.

So I built **UDAM** (Unified Data Marketplace) - an open-source backend that provides all this infrastructure out of the box. In this article, I'll share the technical decisions, challenges, and solutions that went into it.

---

## The Problem Space

Building a marketplace seems straightforward until you start coding:

- **Payments**: Integrating Stripe, handling webhooks, managing checkout sessions
- **Security**: Encrypting API keys, managing sessions, preventing attacks
- **Concurrency**: Preventing overselling when multiple buyers compete for the last unit
- **Access Control**: Issuing tokens, managing permissions, handling revocation
- **Testing**: Ensuring everything works reliably in production

Each of these is a mini-project in itself. UDAM solves all of them.

---

## Architecture Overview

UDAM follows a classic three-tier architecture, but with specific design choices optimized for marketplace needs:

```text
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

### Tech Stack Choices

**Backend: Node.js + Express**

- Fast iteration for marketplace logic
- Excellent Stripe SDK support
- Large ecosystem for future extensions

**Database: PostgreSQL**

- ACID transactions (critical for payments)
- Row-level locking (prevents race conditions)
- Mature, battle-tested in production

**Frontend: Next.js**

- SSR capability for SEO (marketplace discoverability)
- Intentionally minimal - easy to customize
- API-first design

---

## Deep Dive: Token Encryption

One of the most critical features is secure storage of API keys and credentials.

### The Challenge

Sellers provide API keys that buyers need to access their services. These keys must be:

1. Encrypted at rest (database compromise shouldn't expose keys)
2. Decryptable for legitimate buyers (they need the actual key)
3. Never logged or cached in plaintext

### The Solution: AES-256-GCM

```javascript
const crypto = require('crypto');

function encryptToken(apiKey, masterKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}
```

**Key Points:**

- **GCM mode**: Provides both encryption and authentication
- **Random IV**: Each encryption uses a unique initialization vector
- **Auth tag**: Detects tampering attempts
- **Master key**: Stored securely in environment variables (never in code)

This approach means even if someone gets database access, they can't decrypt the API keys without the master key.

---

## Concurrency Control: The Overselling Problem

Here's a scenario that will break naive implementations:

- **T=0**: Listing has 1 unit available at $10
- **T=1**: Buyer A starts purchase
- **T=2**: Buyer B starts purchase (sees 1 unit still available)
- **T=3**: Buyer A completes purchase (units → 0)
- **T=4**: Buyer B completes purchase (units → -1) ❌ OVERSOLD!

### The Solution: Row-Level Locking

PostgreSQL's `FOR UPDATE` clause is our hero:

```sql
BEGIN;

-- Lock the row for this transaction
SELECT * FROM listings 
WHERE id = $1 
FOR UPDATE;

-- Check availability
IF available_units >= units_requested THEN
  UPDATE listings 
  SET available_units = available_units - $2
  WHERE id = $1;
  
  INSERT INTO orders (...) VALUES (...);
END IF;

COMMIT;
```

**How it works:**

1. `FOR UPDATE` locks the row until transaction completes
2. Other transactions wait for the lock to be released
3. Only one transaction can decrement units at a time
4. Impossible to oversell

We verified this works under load with a CI test that spawns 5 concurrent purchase attempts for 3 available units - exactly 3 orders succeed, 2 fail with "insufficient units".

---

## Payment Flow: Instant vs. Stripe Checkout

To optimize user experience, we support two payment flows:

### Instant Token Issuance (Small Orders)

For orders under a configurable threshold (e.g., $5):

1. Order is created
2. Tokens are issued immediately
3. No payment confirmation needed

**Why?** For small amounts, the friction of Stripe checkout hurts conversion more than the risk of fraud.

### Stripe Checkout (Large Orders)

For orders above the threshold:

1. Create Stripe Checkout session
2. Redirect user to Stripe
3. Webhook confirms payment
4. Tokens issued after confirmation

**Implementation:**

```javascript
if (totalPrice <= SMALL_LIMIT) {
  // Instant issuance
  await issueTokens(orderId);
  return { payment_requires_confirmation: false };
} else {
  // Stripe checkout
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: listing.service_name },
        unit_amount: Math.round(totalPrice * 100)
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL
  });
  
  return { 
    payment_requires_confirmation: true,
    stripe_checkout_url: session.url 
  };
}
```

---

## Session Management: Security Without Overhead

Many marketplace tutorials use JWT, but we chose session-based auth:

**Advantages:**

- Instant revocation (crucial for logout)
- Server-side control
- No token expiration edge cases

**Implementation:**

```javascript
// Login creates session
const sessionToken = crypto.randomBytes(32).toString('hex');
await db.query(
  'INSERT INTO sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
  [userId, sessionToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
);

// Middleware validates session
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = await db.query(
    'SELECT * FROM sessions WHERE session_token = $1 AND expires_at > NOW()',
    [token]
  );
  
  if (!session.rows[0]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.userId = session.rows[0].user_id;
  next();
}
```

---

## Testing: CI/CD for Critical Flows

We have comprehensive E2E tests running on every push:

```yaml
- name: E2E small-limit flow
  run: |
    TOKEN=$(curl -X POST /auth/login ...)
    LISTING_ID=$(curl -X POST /listings ...)
    ORDER=$(curl -X POST /orders ...)
    TOKENS=$(curl /tokens ...)
```

**What we test:**

- ✅ Full purchase flow (login → create listing → buy → get tokens)
- ✅ Session revocation (logout → can't access protected routes)
- ✅ Concurrency (5 simultaneous purchases for 3 units)
- ✅ Payment webhooks (in dev mode)

---

## Performance Considerations

### Database Indexes

Critical indexes for marketplace queries:

```sql
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_tokens_buyer ON tokens(buyer_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
```

### Query Optimization

The token retrieval query joins three tables efficiently:

```sql
SELECT 
  t.*,
  l.service_name,
  pgp_sym_decrypt(t.encrypted_access_token, $2) as decrypted_token
FROM tokens t
JOIN listings l ON t.listing_id = l.id
WHERE t.buyer_id = $1
ORDER BY t.created_at DESC;
```

---

## Lessons Learned

### What Worked Well

1. **Row-level locking**: Zero overselling issues in production
2. **AES-256-GCM**: Provides both security and integrity
3. **Instant vs. Stripe**: Improved conversion for small orders
4. **API-first design**: Easy to build any frontend

### What I'd Do Differently

1. **Add caching earlier**: Listing browsing could be cached aggressively
2. **Rate limiting**: Should have been built-in from day one
3. **Better logging**: More structured logs for debugging
4. **GraphQL option**: Some users want more flexible queries

### Common Pitfalls to Avoid

1. **Don't store API keys in plaintext** (even with "secure" database access)
2. **Don't skip transaction isolation** (race conditions WILL happen)
3. **Don't trust client-side validation** (always validate server-side)
4. **Don't hardcode secrets** (environment variables from day one)

---

## What's Next

UDAM is open source (MIT license) and actively maintained. We're looking for contributors in:

- **UI/UX**: Creating beautiful frontend templates
- **Integrations**: Additional payment providers, OAuth, analytics
- **Security**: Audits, penetration testing, best practices
- **Documentation**: Deployment guides, tutorials, translations

**Check it out:**

- [GitHub Repository](https://github.com/data-agent-marketplace/data-agent-marketplace)
- [API Documentation](https://github.com/data-agent-marketplace/data-agent-marketplace/blob/main/API.md)
- [Architecture Details](https://github.com/data-agent-marketplace/data-agent-marketplace/blob/main/ARCHITECTURE.md)

---

## Conclusion

Building marketplace infrastructure is complex, but it doesn't need to be custom every time. UDAM provides a production-ready foundation so you can focus on your actual product - the data services you're selling.

Whether you use UDAM directly or just learn from the architecture, I hope this article helps you build better marketplaces faster.

**Questions? Feedback?** Drop a comment or open a GitHub issue. I'm always happy to discuss marketplace architecture!

---

*Found this useful? Star the repo on GitHub and follow me for more deep dives into building production systems.*