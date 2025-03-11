-- Ensure the database exists
CREATE DATABASE cip60;

-- Connect to the database
\c cip60;

-- Enable pg_trgm extension for GIN index optimization (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create schema
CREATE SCHEMA IF NOT EXISTS cip60;

-- Create indexer state table
CREATE TABLE IF NOT EXISTS cip60.indexer_state (
    id BIGSERIAL PRIMARY KEY,
    last_slot BIGINT NOT NULL,
    last_block_hash VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Use BTREE for timestamp indexing (ordering handled in queries)
CREATE INDEX IF NOT EXISTS idx_indexer_state_updated_at 
ON cip60.indexer_state (updated_at);

-- Create assets table
CREATE TABLE IF NOT EXISTS cip60.assets (
    id BIGSERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL,
    asset_name TEXT NOT NULL,
    metadata_json JSONB NOT NULL,
    metadata_version VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_policy_asset UNIQUE (policy_id, asset_name)
);

-- Index policy_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_assets_policy_id ON cip60.assets (policy_id);

-- Optimize JSONB index using GIN with trigram-based operations
CREATE INDEX IF NOT EXISTS idx_assets_metadata 
ON cip60.assets USING GIN (metadata_json gin_trgm_ops);

-- Function to update updated_at timestamp on update
CREATE OR REPLACE FUNCTION cip60.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



CREATE INDEX IF NOT EXISTS idx_assets_asset_name_trgm ON cip60.assets USING GIN (asset_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_assets_metadata_json_gin ON cip60.assets USING GIN (metadata_json jsonb_path_ops);

-- For sorting by creation date
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON cip60.assets (created_at DESC);

-- For policy_id lookup performance
CREATE INDEX IF NOT EXISTS idx_assets_policy_composite ON cip60.assets (policy_id, asset_name);
=======


-- Trigger to update updated_at only after an update
CREATE TRIGGER update_assets_updated_at
AFTER UPDATE ON cip60.assets
FOR EACH ROW
EXECUTE FUNCTION cip60.update_updated_at_column();

-- Optional: Grant privileges (uncomment and replace 'your_user' if needed)
-- GRANT ALL PRIVILEGES ON DATABASE cip60 TO your_user;
-- GRANT ALL PRIVILEGES ON SCHEMA cip60 TO your_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cip60 TO your_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cip60 TO your_user;
