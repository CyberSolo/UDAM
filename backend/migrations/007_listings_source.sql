ALTER TABLE listings ADD COLUMN IF NOT EXISTS endpoint_url TEXT;
CREATE INDEX IF NOT EXISTS idx_listings_endpoint_url ON listings(endpoint_url);
