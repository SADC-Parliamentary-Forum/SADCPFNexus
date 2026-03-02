-- Create application role for RLS
CREATE ROLE app_user NOLOGIN;
GRANT CONNECT ON DATABASE sadcpfnexus TO app_user;

-- Runtime role used by the API to enforce RLS
-- The SET commands will be done per-request in PHP
