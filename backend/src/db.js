import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const query = (text, params) => pool.query(text, params);
export const init = async () => {
  await query(
    "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, oauth_provider TEXT, created_at TIMESTAMP DEFAULT NOW())"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS listings (id SERIAL PRIMARY KEY, owner_id INTEGER REFERENCES users(id), service_name TEXT NOT NULL, api_key_encrypted TEXT NOT NULL, price_per_unit NUMERIC NOT NULL, unit_description TEXT NOT NULL, available_units INTEGER NOT NULL, status TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, buyer_id INTEGER REFERENCES users(id), listing_id INTEGER REFERENCES listings(id), units INTEGER NOT NULL, payment_amount NUMERIC NOT NULL, payment_status TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS tokens (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id), service_name TEXT NOT NULL, api_key_encrypted TEXT NOT NULL, api_key_plain TEXT, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT NOW())"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS webhook_events (id SERIAL PRIMARY KEY, source TEXT NOT NULL, event_id TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT NOW())"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS disputes (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id), created_by INTEGER REFERENCES users(id), role TEXT NOT NULL, reason TEXT, evidence TEXT, created_at TIMESTAMP DEFAULT NOW())"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id), rater_id INTEGER REFERENCES users(id), ratee_id INTEGER REFERENCES users(id), role TEXT NOT NULL, score INTEGER NOT NULL, comment TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(order_id, rater_id))"
  );
  await query("CREATE INDEX IF NOT EXISTS idx_reviews_ratee ON reviews(ratee_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)");
  await query("CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)");
  await query("CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)");
  await query("CREATE INDEX IF NOT EXISTS idx_orders_escrow_status ON orders(escrow_status)");
  await query("CREATE INDEX IF NOT EXISTS idx_orders_dispute_status ON orders(dispute_status)");
  await query("CREATE INDEX IF NOT EXISTS idx_tokens_order ON tokens(order_id)");
  await query("ALTER TABLE listings ADD COLUMN IF NOT EXISTS endpoint_url TEXT");
  await query("CREATE INDEX IF NOT EXISTS idx_listings_endpoint_url ON listings(endpoint_url)");
  await query(
    "CREATE TABLE IF NOT EXISTS agent_events (id SERIAL PRIMARY KEY, agent_id INTEGER REFERENCES users(id), type TEXT NOT NULL, query TEXT, listing_id INTEGER REFERENCES listings(id), status TEXT NOT NULL, error TEXT, created_at TIMESTAMP DEFAULT NOW())"
  );
  await query("CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON agent_events(agent_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_agent_events_status ON agent_events(status)");
  await query("CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON agent_events(created_at)");
  await query("CREATE INDEX IF NOT EXISTS idx_agent_events_query ON agent_events(query)");
};
