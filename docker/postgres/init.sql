-- Create application role for RLS
CREATE ROLE app_user NOLOGIN;
GRANT CONNECT ON DATABASE sadcpfnexus TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant access to all existing tables (migrations add tables after init, so the
-- RLS migration also calls GRANT; this covers any tables created by init itself)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Ensure tables created by future migrations are automatically accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Runtime role used by the API to enforce RLS; context variables are SET per-request in PHP
