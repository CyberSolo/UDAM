CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  oauth_provider TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  service_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  unit_description TEXT NOT NULL,
  available_units INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES users(id),
  listing_id INTEGER REFERENCES listings(id),
  units INTEGER NOT NULL,
  payment_amount NUMERIC NOT NULL,
  payment_status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  service_name TEXT NOT NULL,
  api_key_plain TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
