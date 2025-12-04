# UDAM API Documentation

Base URL: `http://localhost:4000` (development)

All authenticated endpoints require a valid session token sent as a Bearer token in the Authorization header:

```
Authorization: Bearer <session_token>
```

## Authentication

### Login

Create a new session for a user.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "oauth_provider": "email"
}
```

**Response:** `200 OK`
```json
{
  "session_token": "abc123...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "oauth_provider": "email"
  }
}
```

**Notes:**
- Creates user if not exists
- OAuth provider can be: `email`, `google`, `github`, etc.
- Session token expires based on server configuration

---

### Logout

Revoke current session.

**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:** `200 OK`
```json
{
  "message": "ok"
}
```

**Notes:**
- Invalidates the session immediately
- Subsequent requests with this token will return 401

---

## Listings

### Browse All Listings

Get all active marketplace listings.

**Endpoint:** `GET /listings`

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "service_name": "Weather API Access",
    "price_per_unit": "0.50",
    "unit_description": "per 1000 requests",
    "available_units": 100,
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "service_name": "Stock Market Data Feed",
    "price_per_unit": "10.00",
    "unit_description": "per month",
    "available_units": 0,
    "status": "sold_out",
    "created_at": "2024-01-14T09:00:00Z"
  }
]
```

---

### Get Listing Details

Get detailed information about a specific listing.

**Endpoint:** `GET /listings/:id`

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "service_name": "Weather API Access",
  "price_per_unit": "0.50",
  "unit_description": "per 1000 requests",
  "available_units": 100,
  "status": "active",
  "seller_id": 5,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found` - Listing doesn't exist

---

### Create Listing

Create a new marketplace listing (sellers only).

**Endpoint:** `POST /listings`

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request Body:**
```json
{
  "service_name": "Weather API Access",
  "api_key": "sk_live_abc123xyz789",
  "price_per_unit": "0.50",
  "unit_description": "per 1000 requests",
  "available_units": 100
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "service_name": "Weather API Access",
  "price_per_unit": "0.50",
  "unit_description": "per 1000 requests",
  "available_units": 100,
  "status": "active",
  "seller_id": 5,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Validation:**
- `service_name`: Required, non-empty string
- `api_key`: Required, will be encrypted before storage
- `price_per_unit`: Required, numeric string (e.g., "10.00")
- `unit_description`: Required (e.g., "per month", "per 1000 calls")
- `available_units`: Required, positive integer

**Notes:**
- API key is encrypted with AES-256 before storage
- Only the seller can see the original API key
- Listing status defaults to "active"

---

## Orders

### Create Order

Purchase units from a listing.

**Endpoint:** `POST /orders`

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request Body:**
```json
{
  "listing_id": 1,
  "units_requested": 5
}
```

**Response (Instant Token Issuance):** `200 OK`
```json
{
  "order_id": 42,
  "total_price": "2.50",
  "payment_requires_confirmation": false,
  "tokens_issued": 5
}
```

**Response (Stripe Checkout Required):** `200 OK`
```json
{
  "order_id": 43,
  "total_price": "50.00",
  "payment_requires_confirmation": true,
  "stripe_checkout_url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

**Logic:**
- If `total_price <= SMALL_LIMIT`: Tokens issued instantly
- If `total_price > SMALL_LIMIT` and Stripe configured: Redirect to Stripe Checkout
- If `total_price > SMALL_LIMIT` and no Stripe: Manual confirmation required

**Error Responses:**
- `400 Bad Request` - Invalid listing_id or units_requested
- `409 Conflict` - Insufficient units available
- `401 Unauthorized` - Not logged in

---

### Confirm Order (Dev Mode)

Manually confirm an order without Stripe (development only).

**Endpoint:** `GET /orders/dev/confirm/:order_id`

**Response:** Redirect to success page

**Notes:**
- Only works if Stripe is NOT configured
- Automatically issues tokens
- For testing payment flow without Stripe account

---

## Tokens

### Get My Tokens

Retrieve all tokens purchased by the authenticated user.

**Endpoint:** `GET /tokens`

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "listing_id": 1,
    "service_name": "Weather API Access",
    "decrypted_token": "sk_live_abc123xyz789",
    "order_id": 42,
    "created_at": "2024-01-15T11:00:00Z"
  },
  {
    "id": 2,
    "listing_id": 3,
    "service_name": "Stock Market Data Feed",
    "decrypted_token": "api_key_xyz789abc123",
    "order_id": 45,
    "created_at": "2024-01-16T14:30:00Z"
  }
]
```

**Notes:**
- Tokens are decrypted on-the-fly for the buyer
- Each token corresponds to one unit purchased
- Tokens never expire (unless revoked by seller)

---

## Health Check

### Service Health

Check if the backend service is running.

**Endpoint:** `GET /healthz`

**Response:** `200 OK`
```json
{
  "status": "ok"
}
```

**Notes:**
- No authentication required
- Used for monitoring and load balancer health checks

---

## Error Responses

All endpoints may return these standard errors:

### 400 Bad Request
```json
{
  "error": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "Insufficient units available"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

**Currently:** No rate limiting implemented

**Recommended for Production:**
- 100 requests/minute per IP
- 1000 requests/hour per authenticated user
- Implement with middleware like `express-rate-limit`

---

## CORS Configuration

**Development:** `http://localhost:3000`

**Production:** Configure `FRONTEND_ORIGIN` environment variable

---

## Webhooks (Stripe)

### Payment Success Webhook

**Endpoint:** `POST /stripe/webhook`

**Notes:**
- Automatically called by Stripe on successful payment
- Verifies webhook signature
- Issues tokens to buyer
- Marks order as completed

**Required Configuration:**
- `STRIPE_WEBHOOK_SECRET` environment variable
- Webhook endpoint registered in Stripe dashboard

---

## Example API Usage

### Complete Purchase Flow

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:4000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'buyer@example.com',
    oauth_provider: 'email'
  })
});
const { session_token } = await loginResponse.json();

// 2. Browse listings
const listingsResponse = await fetch('http://localhost:4000/listings');
const listings = await listingsResponse.json();

// 3. Create order
const orderResponse = await fetch('http://localhost:4000/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session_token}`
  },
  body: JSON.stringify({
    listing_id: 1,
    units_requested: 2
  })
});
const order = await orderResponse.json();

// 4a. If instant tokens issued
if (!order.payment_requires_confirmation) {
  console.log('Tokens issued instantly!');
}

// 4b. If Stripe checkout required
if (order.payment_requires_confirmation && order.stripe_checkout_url) {
  window.location.href = order.stripe_checkout_url;
}

// 5. Check tokens
const tokensResponse = await fetch('http://localhost:4000/tokens', {
  headers: { 'Authorization': `Bearer ${session_token}` }
});
const tokens = await tokensResponse.json();
console.log('My tokens:', tokens);
```

---

## Security Best Practices

1. **Always use HTTPS in production**
2. **Store session tokens securely** (HTTP-only cookies recommended)
3. **Never expose API keys** in client-side code
4. **Validate all inputs** on the server
5. **Use environment variables** for secrets
6. **Rotate master encryption key** periodically
7. **Monitor for suspicious activity** (unusual order patterns)

---

**Questions about the API?** Open a GitHub issue!