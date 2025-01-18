CREATE DATABASE cip60;

\c cip60;

CREATE SCHEMA IF NOT EXISTS cip60;

CREATE TABLE IF NOT EXISTS cip60.indexer_state (
    id SERIAL PRIMARY KEY,
    last_slot BIGINT NOT NULL,
    last_block_hash VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_indexer_state_updated_at ON cip60.indexer_state (updated_at DESC);

CREATE TABLE IF NOT EXISTS cip60.assets (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL,
    asset_name TEXT NOT NULL,
    metadata_json JSONB NOT NULL,
    metadata_version VARCHAR(10) NOT NULL,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_policy_asset UNIQUE (policy_id, asset_name)
);

CREATE INDEX IF NOT EXISTS idx_assets_policy_id ON cip60.assets (policy_id);

CREATE INDEX IF NOT EXISTS idx_assets_metadata ON cip60.assets USING GIN (metadata_json);

CREATE OR REPLACE FUNCTION cip60.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON cip60.assets
    FOR EACH ROW
    EXECUTE FUNCTION cip60.update_updated_at_column();

-- Grant necessary permissions if you're using a specific user
-- Replace 'your_user' with the actual username if needed
-- GRANT ALL PRIVILEGES ON DATABASE cip60 TO your_user;
-- GRANT ALL PRIVILEGES ON SCHEMA cip60 TO your_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cip60 TO your_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cip60 TO your_user;
