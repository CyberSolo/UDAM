ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS escrow_status TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dispute_status TEXT,
  ADD COLUMN IF NOT EXISTS adjudicated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS adjudication_result TEXT;

CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  created_by INTEGER REFERENCES users(id),
  role TEXT NOT NULL, -- 'buyer' | 'seller'
  reason TEXT,
  evidence TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
