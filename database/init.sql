-- Create a read & write user with limited privileges
CREATE USER app_user WITH ENCRYPTED PASSWORD 'secure_readwrite_password';

-- Ensure the admin user has full privileges
ALTER ROLE admin_user WITH SUPERUSER;

-- Grant permissions to the api user
GRANT CONNECT ON DATABASE mydatabase TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT, INSERT, UPDATE, DELETE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Ensure future tables and sequences have the correct permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_user;

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index email for faster lookups
CREATE INDEX idx_users_email ON users(email);
