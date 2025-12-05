import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { init, query } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";
import { issueToken, requireAuth } from "./auth.js";
dotenv.config();
const app = express();
const allowed = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").split(",").map((x) => x.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      cb(null, allowed.includes(origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use((req, res, next) => {
  const rid = uuidv4();
  req.rid = rid;
  res.on("finish", () => {
    try {
      console.log(
        JSON.stringify({ rid, method: req.method, path: req.path, status: res.statusCode })
      );
    } catch {}
  });
  next();
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const smallLimit = parseFloat(process.env.SMALL_LIMIT || "5");
const acceptanceWindowSec = parseInt(process.env.ACCEPTANCE_WINDOW_SEC || "600");
const port = process.env.PORT || 4000;
const num = (v, d) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : d;
};
const wAge = num(process.env.WEIGHT_AGE, 0.05);
const wVolume = num(process.env.WEIGHT_VOLUME, 0.03);
const wComplaint = num(process.env.WEIGHT_COMPLAINT, 0.5);
const wLatency = num(process.env.WEIGHT_LATENCY, 0.02);
const ageMaxDays = num(process.env.AGE_MAX_DAYS, 365);
const latencyMaxHours = num(process.env.LATENCY_MAX_HOURS, 48);
const dashCacheMs = parseInt(process.env.DASHBOARD_CACHE_MS || "3000");
const listCacheMs = parseInt(process.env.LISTINGS_CACHE_MS || "1500");
const cacheStore = new Map();
const cacheGet = (k) => {
  const e = cacheStore.get(k);
  if (!e) return null;
  if (Date.now() > e.expires) {
    cacheStore.delete(k);
    return null;
  }
  return e.data;
};
const cacheSet = (k, data, ttlMs) => {
  cacheStore.set(k, { data, expires: Date.now() + Math.max(0, ttlMs || 0) });
};
const validateEnv = () => {
  const s = String(process.env.SESSION_SECRET || "");
  if (s.length < 16) throw new Error("bad_session_secret");
  const mk = String(process.env.MARKETPLACE_MASTER_KEY || "");
  const buf = Buffer.from(mk, "hex");
  if (buf.length !== 32) throw new Error("bad_master_key");
};
const recordAgentEvent = async (agent_id, type, queryText, listing_id, status, error = null) => {
  await query(
    "INSERT INTO agent_events(agent_id, type, query, listing_id, status, error) VALUES($1,$2,$3,$4,$5,$6)",
    [agent_id, type, queryText, listing_id, status, error]
  );
};
const fulfillOrderIssueToken = async (order_id, listing_id, units, service_name, api_key_encrypted) => {
  const apiKey = decrypt(api_key_encrypted);
  const expires_at = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const encToken = encrypt(apiKey);
  await query(
    "INSERT INTO tokens(order_id, service_name, api_key_encrypted, expires_at) VALUES($1,$2,$3,$4)",
    [order_id, service_name, encToken, expires_at]
  );
  await query(
    "UPDATE listings SET available_units=available_units-$1, status=CASE WHEN available_units-$1<=0 THEN 'sold_out' ELSE status END WHERE id=$2",
    [units, listing_id]
  );
};
app.post("/auth/login", async (req, res) => {
  const email = String(req.body.email || "").toLowerCase();
  const provider = String(req.body.oauth_provider || "email");
  if (!email) return res.status(400).json({ error: "email_required" });
  let r = await query("SELECT id FROM users WHERE email=$1", [email]);
  let id = r.rows[0]?.id;
  if (!id) {
    r = await query("INSERT INTO users(email, oauth_provider) VALUES($1,$2) RETURNING id", [email, provider]);
    id = r.rows[0].id;
  }
  const session_token = issueToken(id);
  res.json({ user_id: id, session_token });
});
app.get("/listings", async (req, res) => {
  const dedup = String(req.query?.dedup || "0") === "1";
  const sort = String(req.query?.sort || "weight");
  const ck = `listings:${dedup ? 1 : 0}:${sort}`;
  const cached = cacheGet(ck);
  if (cached) return res.json(cached);
  const keyExpr = "COALESCE(l.endpoint_url,l.service_name)";
  let baseCte =
    "WITH ratings AS (SELECT ratee_id, AVG(score) AS avg_score, COUNT(*) AS cnt FROM reviews GROUP BY ratee_id)," +
    " sales AS (SELECT listing_id, COUNT(*) AS orders_count, COALESCE(SUM(units),0) AS units_sum FROM orders WHERE payment_status='paid' GROUP BY listing_id)," +
    " complaints AS (SELECT o.listing_id, COUNT(DISTINCT o.id) AS disputed_orders FROM orders o WHERE o.dispute_status IS NOT NULL AND o.dispute_status<>'' GROUP BY o.listing_id)," +
    " latency AS (SELECT o.listing_id, AVG(EXTRACT(EPOCH FROM (t.created_at - o.created_at))) AS avg_latency_sec FROM tokens t JOIN orders o ON t.order_id=o.id GROUP BY o.listing_id)";
  const selectCols =
    " l.id, l.service_name, l.endpoint_url, l.price_per_unit, l.unit_description, l.available_units, " +
    " COALESCE(r.avg_score,0) AS avg_score, COALESCE(r.cnt,0) AS rating_count, l.created_at, " +
    " COALESCE(s.orders_count,0) AS orders_count, COALESCE(s.units_sum,0) AS units_sold, COALESCE(c.disputed_orders,0) AS disputed_orders, COALESCE(lx.avg_latency_sec,0) AS avg_latency_sec, " +
    ` (COALESCE(r.avg_score,0) + ${wAge} * LEAST(EXTRACT(EPOCH FROM (NOW() - l.created_at))/86400, ${ageMaxDays}) + ${wVolume} * LN(1 + COALESCE(s.units_sum,0)) - ${wComplaint} * CASE WHEN COALESCE(s.orders_count,0)=0 THEN 0 ELSE LEAST(COALESCE(c.disputed_orders,0)::numeric / NULLIF(s.orders_count,0), 1) END - ${wLatency} * LEAST(COALESCE(lx.avg_latency_sec,0)/3600, ${latencyMaxHours})) AS weight `;
  const fromJoin =
    " FROM listings l LEFT JOIN ratings r ON r.ratee_id=l.owner_id LEFT JOIN sales s ON s.listing_id=l.id LEFT JOIN complaints c ON c.listing_id=l.id LEFT JOIN latency lx ON lx.listing_id=l.id WHERE l.status='active' ";
  let primaryOrder = "weight DESC";
  if (sort === "rating") primaryOrder = "avg_score DESC";
  if (sort === "price") primaryOrder = "l.price_per_unit ASC";
  if (dedup) {
    const r = await query(
      `${baseCte} SELECT DISTINCT ON (${keyExpr}) ${selectCols} ${fromJoin} ORDER BY ${keyExpr}, ${primaryOrder}`
    );
    cacheSet(ck, r.rows, listCacheMs);
    return res.json(r.rows);
  }
  const r = await query(`${baseCte} SELECT ${selectCols} ${fromJoin} ORDER BY ${primaryOrder}, l.id DESC`);
  cacheSet(ck, r.rows, listCacheMs);
  res.json(r.rows);
});
app.post("/auth/logout", requireAuth, async (req, res) => {
  if (!req.jti) return res.status(200).json({ ok: true });
  await query("INSERT INTO revoked_tokens(jti, user_id) VALUES($1,$2) ON CONFLICT (jti) DO NOTHING", [req.jti, req.userId]);
  res.json({ ok: true });
});
app.post("/listings", requireAuth, async (req, res) => {
  const owner_id = req.userId;
  const { service_name, api_key, price_per_unit, unit_description, available_units, endpoint_url } = req.body;
  if (!service_name || !api_key || !price_per_unit || !unit_description || !available_units)
    return res.status(400).json({ error: "missing_fields" });
  const sn = String(service_name);
  const ud = String(unit_description);
  const ak = String(api_key);
  const pp = String(price_per_unit);
  const eu = endpoint_url ? String(endpoint_url) : null;
  if (sn.length < 1 || sn.length > 128) return res.status(400).json({ error: "bad_service_name" });
  if (ud.length < 1 || ud.length > 128) return res.status(400).json({ error: "bad_unit_description" });
  if (ak.length < 1 || ak.length > 4096) return res.status(400).json({ error: "bad_api_key" });
  if (!/^\d+(\.\d{1,2})?$/.test(pp)) return res.status(400).json({ error: "bad_price" });
  const p = Number(pp);
  const a = parseInt(available_units);
  if (!Number.isFinite(p) || p <= 0 || p > 1e9) return res.status(400).json({ error: "bad_price" });
  if (!Number.isInteger(a) || a <= 0 || a > 1e6) return res.status(400).json({ error: "bad_available_units" });
  if (eu && !/^https?:\/\//i.test(eu)) return res.status(400).json({ error: "bad_endpoint_url" });
  const enc = encrypt(String(api_key));
  const r = await query(
    "INSERT INTO listings(owner_id, service_name, api_key_encrypted, price_per_unit, unit_description, available_units, status, endpoint_url) VALUES($1,$2,$3,$4,$5,$6,'active',$7) RETURNING id",
    [owner_id, service_name, enc, p, unit_description, a, eu]
  );
  res.json({ id: r.rows[0].id });
});
app.post("/orders", requireAuth, async (req, res) => {
  const buyer_id = req.userId;
  const listing_id = parseInt(req.body.listing_id);
  const units = parseInt(req.body.units_requested || req.body.units || 1);
  if (!listing_id || !units) return res.status(400).json({ error: "missing_fields" });
  if (!Number.isInteger(units) || units <= 0 || units > 1e6) return res.status(400).json({ error: "bad_units" });
  await query("BEGIN");
  try {
    const lr = await query(
      "SELECT id, price_per_unit, available_units, api_key_encrypted, service_name FROM listings WHERE id=$1 FOR UPDATE",
      [listing_id]
    );
    const listing = lr.rows[0];
    if (!listing) {
      await query("ROLLBACK");
      await recordAgentEvent(buyer_id, "order_attempt", `listing:${listing_id}`, listing_id, "failed", "listing_not_found");
      return res.status(404).json({ error: "listing_not_found" });
    }
    if (listing.available_units < units) {
      await query("ROLLBACK");
      await recordAgentEvent(buyer_id, "order_attempt", listing.service_name, listing_id, "failed", "insufficient_units");
      return res.status(400).json({ error: "insufficient_units" });
    }
    const payment_amount = ((Math.round(Number(listing.price_per_unit) * 100) * units) / 100).toFixed(2);
    const or = await query(
      "INSERT INTO orders(buyer_id, listing_id, units, payment_amount, payment_status) VALUES($1,$2,$3,$4,'pending') RETURNING id",
      [buyer_id, listing_id, units, payment_amount]
    );
    const order_id = or.rows[0].id;
    let payment_url = null;
    let payment_requires_confirmation = false;
    if (Number(payment_amount) <= smallLimit) {
      const deadline = new Date(Date.now() + acceptanceWindowSec * 1000);
      await query("UPDATE orders SET payment_status='paid', escrow_status='held', acceptance_deadline=$2 WHERE id=$1", [order_id, deadline]);
      await fulfillOrderIssueToken(order_id, listing_id, units, listing.service_name, listing.api_key_encrypted);
      await query("COMMIT");
      await recordAgentEvent(buyer_id, "order_attempt", listing.service_name, listing_id, "ordered");
    } else {
      await query("COMMIT");
      payment_requires_confirmation = true;
      if (!process.env.STRIPE_SECRET_KEY) {
        payment_url = `${process.env.BACKEND_PUBLIC_URL || `http://localhost:${port}`}/orders/dev/confirm/${order_id}`;
      } else {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: listing.service_name },
                unit_amount: Math.round(Number(listing.price_per_unit) * 100),
              },
              quantity: units,
            },
          ],
          success_url: `${process.env.SUCCESS_URL || "http://localhost:3000"}/orders/success?order_id=${order_id}`,
          cancel_url: `${process.env.CANCEL_URL || "http://localhost:3000"}/orders/cancel?order_id=${order_id}`,
          metadata: { order_id: String(order_id), buyer_id: String(buyer_id) },
        });
        payment_url = session.url;
      }
    }
    res.json({ order_id, payment_amount, payment_requires_confirmation, payment_url });
  } catch (e) {
    await query("ROLLBACK");
    try {
      await recordAgentEvent(buyer_id, "order_attempt", `listing:${listing_id}`, listing_id, "failed", "internal");
    } catch {}
    throw e;
  }
});
app.get("/listings/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const r = await query(
    "SELECT id, service_name, endpoint_url, price_per_unit, unit_description, available_units, status FROM listings WHERE id=$1",
    [id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "not_found" });
  res.json(r.rows[0]);
});
app.get("/orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const r = await query(
    "SELECT id, payment_amount, payment_status, escrow_status, acceptance_deadline, accepted_at, dispute_status, adjudicated_at, adjudication_result, created_at FROM orders WHERE id=$1",
    [id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "not_found" });
  res.json(r.rows[0]);
});
app.get("/tokens", requireAuth, async (req, res) => {
  const uid = req.userId;
  const r = await query(
    "SELECT t.id as token_id, t.service_name, t.api_key_encrypted, t.expires_at FROM tokens t JOIN orders o ON t.order_id=o.id WHERE o.buyer_id=$1 ORDER BY t.id DESC",
    [uid]
  );
  res.json(
    r.rows.map((row) => ({ token_id: row.token_id, service_name: row.service_name, api_key: decrypt(row.api_key_encrypted), expires_at: row.expires_at }))
  );
});
app.post("/webhooks/stripe", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  let event = null;
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    return res.status(400).send("bad");
  }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const order_id = parseInt(s.metadata?.order_id || "0");
    if (order_id) {
      const ins = await query(
        "INSERT INTO webhook_events(source, event_id) VALUES($1,$2) ON CONFLICT (event_id) DO NOTHING RETURNING id",
        ["stripe", event.id]
      );
      if (ins.rows.length === 0) return res.json({ received: true });
      await query("BEGIN");
      try {
        const lr = await query(
          "SELECT listings.api_key_encrypted, listings.service_name, orders.listing_id, orders.units FROM orders JOIN listings ON orders.listing_id=listings.id WHERE orders.id=$1 FOR UPDATE",
          [order_id]
        );
        const row = lr.rows[0];
        if (row) {
          const deadline = new Date(Date.now() + acceptanceWindowSec * 1000);
          await query("UPDATE orders SET payment_status='paid', escrow_status='held', acceptance_deadline=$2 WHERE id=$1", [order_id, deadline]);
          await fulfillOrderIssueToken(order_id, row.listing_id, row.units, row.service_name, row.api_key_encrypted);
        }
        await query("COMMIT");
      } catch (e) {
        await query("ROLLBACK");
        throw e;
      }
    }
  }
  res.json({ received: true });
});
app.get("/healthz", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

const buckets = new Map();
const limitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000");
const limitCount = parseInt(process.env.RATE_LIMIT_COUNT || "120");
app.use((req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const b = buckets.get(key) || { t: now, c: 0 };
  if (now - b.t > limitWindowMs) {
    b.t = now;
    b.c = 0;
  }
  b.c += 1;
  buckets.set(key, b);
  if (b.c > limitCount) return res.status(429).json({ error: "rate_limited" });
  next();
});
const requireAdmin = (req, res, next) => {
  const t = req.headers["x-admin-token"] || "";
  if (!process.env.ADMIN_TOKEN || t !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
};
// Dev-only payment confirmation when Stripe is not configured
app.get("/orders/dev/confirm/:id", async (req, res) => {
  if (process.env.STRIPE_SECRET_KEY) return res.status(400).json({ error: "stripe_configured" });
  const order_id = parseInt(req.params.id);
  await query("BEGIN");
  try {
    const lr = await query(
      "SELECT listings.api_key_encrypted, listings.service_name, orders.listing_id, orders.units FROM orders JOIN listings ON orders.listing_id=listings.id WHERE orders.id=$1 FOR UPDATE",
      [order_id]
    );
    const row = lr.rows[0];
    if (!row) {
      await query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }
    const deadline = new Date(Date.now() + acceptanceWindowSec * 1000);
    await query("UPDATE orders SET payment_status='paid', escrow_status='held', acceptance_deadline=$2 WHERE id=$1", [order_id, deadline]);
    await fulfillOrderIssueToken(order_id, row.listing_id, row.units, row.service_name, row.api_key_encrypted);
    await query("COMMIT");
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }
  const success = `${process.env.SUCCESS_URL || "http://localhost:3000"}/orders/success?order_id=${order_id}`;
  res.redirect(success);
});
app.post("/orders/:id/accept", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const r = await query("UPDATE orders SET accepted_at=NOW(), escrow_status='released' WHERE id=$1 AND buyer_id=$2 RETURNING id", [id, req.userId]);
  if (!r.rows[0]) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
app.post("/orders/:id/dispute", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason, evidence } = req.body || {};
  await query("BEGIN");
  try {
    const r = await query("UPDATE orders SET dispute_status='buyer_disputed' WHERE id=$1 AND buyer_id=$2 RETURNING id", [id, req.userId]);
    if (!r.rows[0]) {
      await query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }
    await query("INSERT INTO disputes(order_id, created_by, role, reason, evidence) VALUES($1,$2,'buyer',$3,$4)", [id, req.userId, String(reason||''), String(evidence||'')]);
    await query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }
});
app.post("/orders/:id/counter", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason, evidence } = req.body || {};
  const lr = await query("SELECT l.owner_id FROM orders o JOIN listings l ON o.listing_id=l.id WHERE o.id=$1", [id]);
  const owner = lr.rows[0]?.owner_id;
  if (owner !== req.userId) return res.status(403).json({ error: "forbidden" });
  await query("BEGIN");
  try {
    await query("UPDATE orders SET dispute_status='seller_countered' WHERE id=$1", [id]);
    await query("INSERT INTO disputes(order_id, created_by, role, reason, evidence) VALUES($1,$2,'seller',$3,$4)", [id, req.userId, String(reason||''), String(evidence||'')]);
    await query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }
});
app.post("/admin/seed/free-listings", requireAdmin, async (req, res) => {
  const seeds = [
    { name: "SpaceX API", url: "https://api.spacexdata.com/v5", unit: "request" },
    { name: "Public APIs", url: "https://api.publicapis.org/entries", unit: "request" },
    { name: "CoinDesk Price", url: "https://api.coindesk.com/v1/bpi/currentprice.json", unit: "request" },
    { name: "Open-Meteo", url: "https://api.open-meteo.com/v1/forecast", unit: "request" },
    { name: "Cat Facts", url: "https://catfact.ninja/fact", unit: "request" },
    { name: "JSONPlaceholder", url: "https://jsonplaceholder.typicode.com", unit: "request" },
    { name: "GitHub Events", url: "https://api.github.com/events", unit: "request" },
    { name: "IPify", url: "https://api.ipify.org?format=json", unit: "request" },
  ];
  await query("BEGIN");
  try {
    const sys = await query("SELECT id FROM users WHERE email=$1", ["system@udam.local"]);
    let owner_id = sys.rows[0]?.id;
    if (!owner_id) {
      const ins = await query("INSERT INTO users(email, oauth_provider) VALUES($1,$2) RETURNING id", ["system@udam.local", "system"]);
      owner_id = ins.rows[0].id;
    }
    const encNone = encrypt("NONE");
    let created = 0;
    for (const s of seeds) {
      const exists = await query("SELECT id FROM listings WHERE owner_id=$1 AND service_name=$2", [owner_id, s.name]);
      if (exists.rows[0]) continue;
      await query(
        "INSERT INTO listings(owner_id, service_name, api_key_encrypted, price_per_unit, unit_description, available_units, status, endpoint_url) VALUES($1,$2,$3,$4,$5,$6,'active',$7)",
        [owner_id, s.name, encNone, 0, s.unit, 100000, s.url]
      );
      created += 1;
    }
    await query("COMMIT");
    res.json({ ok: true, created });
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }
});
app.post("/orders/:id/review", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const score = parseInt(req.body?.score);
  const comment = String(req.body?.comment || "");
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: "bad_score" });
  const r = await query(
    "SELECT o.buyer_id, o.escrow_status, l.owner_id FROM orders o JOIN listings l ON o.listing_id=l.id WHERE o.id=$1",
    [id]
  );
  const row = r.rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });
  if (!["released","refunded"].includes(row.escrow_status || "")) return res.status(400).json({ error: "not_completed" });
  let role = null;
  let ratee = null;
  if (req.userId === row.buyer_id) {
    role = "buyer";
    ratee = row.owner_id;
  } else if (req.userId === row.owner_id) {
    role = "seller";
    ratee = row.buyer_id;
  } else {
    return res.status(403).json({ error: "forbidden" });
  }
  const dup = await query("SELECT id FROM reviews WHERE order_id=$1 AND rater_id=$2", [id, req.userId]);
  if (dup.rows[0]) return res.status(409).json({ error: "already_reviewed" });
  await query(
    "INSERT INTO reviews(order_id, rater_id, ratee_id, role, score, comment) VALUES($1,$2,$3,$4,$5,$6)",
    [id, req.userId, ratee, role, score, comment]
  );
  res.json({ ok: true });
});
app.get("/users/:id/ratings", async (req, res) => {
  const id = parseInt(req.params.id);
  const agg = await query("SELECT AVG(score) AS avg_score, COUNT(*) AS count FROM reviews WHERE ratee_id=$1", [id]);
  const list = await query(
    "SELECT r.id, r.role, r.score, r.comment, r.created_at, u.email AS rater_email FROM reviews r JOIN users u ON r.rater_id=u.id WHERE r.ratee_id=$1 ORDER BY r.id DESC LIMIT 10",
    [id]
  );
  res.json({ avg_score: Number(agg.rows[0]?.avg_score || 0), count: parseInt(agg.rows[0]?.count || 0), recent: list.rows });
});
app.post("/orders/:id/adjudicate", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const decision = String(req.body.decision || "");
  if (!["refund","release"].includes(decision)) return res.status(400).json({ error: "bad_decision" });
  await query("BEGIN");
  try {
    if (decision === "refund") {
      await query("UPDATE orders SET escrow_status='refunded', adjudicated_at=NOW(), adjudication_result='refund', dispute_status='resolved' WHERE id=$1", [id]);
      await query("UPDATE tokens SET expires_at=NOW() WHERE order_id=$1", [id]);
    } else {
      await query("UPDATE orders SET escrow_status='released', adjudicated_at=NOW(), adjudication_result='release', dispute_status='resolved' WHERE id=$1", [id]);
    }
    await query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }
});
app.post("/orders/cron/auto-release", requireAdmin, async (req, res) => {
  const r = await query("UPDATE orders SET escrow_status='released' WHERE escrow_status='held' AND (dispute_status IS NULL OR dispute_status='') AND acceptance_deadline<NOW() RETURNING id");
  res.json({ released: r.rows.length });
});
app.post("/agent/events", requireAuth, async (req, res) => {
  const agent_id = req.userId;
  const type = String(req.body?.type || "");
  const queryText = String(req.body?.query || "");
  const listing_id = req.body?.listing_id ? parseInt(req.body.listing_id) : null;
  const status = String(req.body?.status || "");
  const error = req.body?.error ? String(req.body.error) : null;
  if (!["search","order_attempt"].includes(type)) return res.status(400).json({ error: "bad_type" });
  if (!["matched","unmatched","ordered","failed"].includes(status)) return res.status(400).json({ error: "bad_status" });
  const r = await query(
    "INSERT INTO agent_events(agent_id, type, query, listing_id, status, error) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [agent_id, type, queryText, listing_id, status, error]
  );
  res.json({ id: r.rows[0].id });
});
app.get("/dashboard/summary", requireAuth, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query?.days || "30"), 1), 365);
  const ck = `dash:summary:${days}`;
  const cached = cacheGet(ck);
  if (cached) return res.json(cached);
  const users = await query("SELECT COUNT(*)::int AS c FROM users");
  const listings = await query("SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE status='active')::int AS active FROM listings");
  const orders = await query(
    "SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE payment_status='paid')::int AS paid, COUNT(*) FILTER (WHERE payment_status<>'paid')::int AS pending, COUNT(*) FILTER (WHERE dispute_status IS NOT NULL AND dispute_status<>'')::int AS disputes, COUNT(*) FILTER (WHERE escrow_status='refunded')::int AS refunded, COUNT(*) FILTER (WHERE escrow_status='released')::int AS released FROM orders"
  );
  const gmv = await query("SELECT COALESCE(SUM(payment_amount),0)::numeric AS amount FROM orders WHERE payment_status='paid'", []);
  const windowOrders = await query(
    "SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE payment_status='paid')::int AS paid FROM orders WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')",
    [days]
  );
  const windowGmv = await query(
    "SELECT COALESCE(SUM(payment_amount),0)::numeric AS amount FROM orders WHERE payment_status='paid' AND created_at >= NOW() - ($1::int * INTERVAL '1 day')",
    [days]
  );
  const topSellers = await query(
    "SELECT l.owner_id AS user_id, u.email, COUNT(*)::int AS orders_count, COALESCE(SUM(o.payment_amount),0)::numeric AS sales_amount FROM orders o JOIN listings l ON o.listing_id=l.id JOIN users u ON l.owner_id=u.id WHERE o.payment_status='paid' AND o.created_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY l.owner_id, u.email ORDER BY sales_amount DESC LIMIT 10",
    [days]
  );
  const topBuyers = await query(
    "SELECT o.buyer_id AS user_id, u.email, COUNT(*)::int AS orders_count, COALESCE(SUM(o.payment_amount),0)::numeric AS spend_amount FROM orders o JOIN users u ON o.buyer_id=u.id WHERE o.payment_status='paid' AND o.created_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY o.buyer_id, u.email ORDER BY spend_amount DESC LIMIT 10",
    [days]
  );
  const agentStatsQ = await query(
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='matched')::int AS matched, COUNT(*) FILTER (WHERE status='unmatched')::int AS unmatched, COUNT(*) FILTER (WHERE status='ordered')::int AS ordered, COUNT(*) FILTER (WHERE status='failed')::int AS failed FROM agent_events WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')",
    [days]
  );
  const topQueries = await query(
    "SELECT query, COUNT(*)::int AS c FROM agent_events WHERE query IS NOT NULL AND query<>'' AND created_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY query ORDER BY c DESC LIMIT 10",
    [days]
  );
  const recentEvents = await query(
    "SELECT e.id, e.agent_id, u.email AS agent_email, e.type, e.query, e.listing_id, e.status, e.error, e.created_at FROM agent_events e LEFT JOIN users u ON e.agent_id=u.id WHERE e.created_at >= NOW() - ($1::int * INTERVAL '1 day') ORDER BY e.id DESC LIMIT 20",
    [days]
  );
  const payload = {
    totals: {
      users: users.rows[0]?.c || 0,
      listings: listings.rows[0]?.c || 0,
      active_listings: listings.rows[0]?.active || 0,
      orders: orders.rows[0]?.c || 0,
      paid_orders: orders.rows[0]?.paid || 0,
      pending_orders: orders.rows[0]?.pending || 0,
      disputes: orders.rows[0]?.disputes || 0,
      refunded: orders.rows[0]?.refunded || 0,
      released: orders.rows[0]?.released || 0,
    },
    gmv: Number(gmv.rows[0]?.amount || 0),
    window: {
      days,
      orders: windowOrders.rows[0]?.c || 0,
      paid_orders: windowOrders.rows[0]?.paid || 0,
      gmv: Number(windowGmv.rows[0]?.amount || 0),
    },
    top_sellers: topSellers.rows,
    top_buyers: topBuyers.rows,
    agent_stats: agentStatsQ.rows[0] || { total: 0, matched: 0, unmatched: 0, ordered: 0, failed: 0 },
    top_queries: topQueries.rows,
    recent_agent_events: recentEvents.rows,
  };
  cacheSet(ck, payload, dashCacheMs);
  res.json(payload);
});
app.get("/dashboard/orders/recent", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query?.limit || "20"), 1), 100);
  const days = Math.min(Math.max(parseInt(req.query?.days || "30"), 1), 365);
  const ck = `dash:recent:${days}:${limit}`;
  const cached = cacheGet(ck);
  if (cached) return res.json(cached);
  const r = await query(
    "SELECT o.id, o.payment_amount, o.payment_status, o.escrow_status, o.dispute_status, o.created_at, u.email AS buyer_email, s.email AS seller_email, l.service_name FROM orders o JOIN users u ON o.buyer_id=u.id JOIN listings l ON o.listing_id=l.id JOIN users s ON l.owner_id=s.id WHERE o.created_at >= NOW() - ($2::int * INTERVAL '1 day') ORDER BY o.id DESC LIMIT $1",
    [limit, days]
  );
  cacheSet(ck, r.rows, dashCacheMs);
  res.json(r.rows);
});
app.get("/dashboard/me", requireAuth, async (req, res) => {
  const uid = req.userId;
  const buyerSpend = await query(
    "SELECT COALESCE(SUM(payment_amount),0)::numeric AS paid_amount, COUNT(*) FILTER (WHERE payment_status='paid')::int AS paid_count, COUNT(*) FILTER (WHERE payment_status<>'paid')::int AS pending_count FROM orders WHERE buyer_id=$1",
    [uid]
  );
  const sellerSales = await query(
    "SELECT COALESCE(SUM(o.payment_amount),0)::numeric AS paid_amount, COUNT(*) FILTER (WHERE o.payment_status='paid')::int AS paid_count FROM orders o JOIN listings l ON o.listing_id=l.id WHERE l.owner_id=$1",
    [uid]
  );
  const sellerHeld = await query(
    "SELECT COALESCE(SUM(o.payment_amount),0)::numeric AS amount, COUNT(*)::int AS count FROM orders o JOIN listings l ON o.listing_id=l.id WHERE l.owner_id=$1 AND o.escrow_status='held'",
    [uid]
  );
  const sellerReleased = await query(
    "SELECT COALESCE(SUM(o.payment_amount),0)::numeric AS amount, COUNT(*)::int AS count FROM orders o JOIN listings l ON o.listing_id=l.id WHERE l.owner_id=$1 AND o.escrow_status='released'",
    [uid]
  );
  const sellerRefunded = await query(
    "SELECT COALESCE(SUM(o.payment_amount),0)::numeric AS amount, COUNT(*)::int AS count FROM orders o JOIN listings l ON o.listing_id=l.id WHERE l.owner_id=$1 AND o.escrow_status='refunded'",
    [uid]
  );
  res.json({
    buyer: {
      paid_amount: Number(buyerSpend.rows[0]?.paid_amount || 0),
      paid_count: buyerSpend.rows[0]?.paid_count || 0,
      pending_count: buyerSpend.rows[0]?.pending_count || 0,
    },
    seller: {
      paid_amount: Number(sellerSales.rows[0]?.paid_amount || 0),
      paid_count: sellerSales.rows[0]?.paid_count || 0,
      held_amount: Number(sellerHeld.rows[0]?.amount || 0),
      held_count: sellerHeld.rows[0]?.count || 0,
      released_amount: Number(sellerReleased.rows[0]?.amount || 0),
      released_count: sellerReleased.rows[0]?.count || 0,
      refunded_amount: Number(sellerRefunded.rows[0]?.amount || 0),
      refunded_count: sellerRefunded.rows[0]?.count || 0,
    },
  });
});
app.use((err, req, res, next) => {
  res.status(500).json({ error: "internal" });
});
init()
  .then(() => {
    try {
      validateEnv();
      app.listen(port, "0.0.0.0", () => {
        console.log(`Server listening on port ${port}`);
      });
    } catch (e) {
      console.error("Startup validation failed:", e);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error("Database init failed:", e);
    process.exit(1);
  });
