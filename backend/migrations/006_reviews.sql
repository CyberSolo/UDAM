CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  rater_id INTEGER REFERENCES users(id),
  ratee_id INTEGER REFERENCES users(id),
  role TEXT NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(order_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_ratee ON reviews(ratee_id);
