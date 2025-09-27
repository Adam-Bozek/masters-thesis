-- Check if the user exists before creating it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'Endless3686') THEN
        CREATE USER "Endless3686" WITH ENCRYPTED PASSWORD 'txVxtwes5A4UK5hM';
    END IF;
END $$;

-- Ensure the admin user has full privileges
ALTER ROLE "Underling5982" WITH SUPERUSER;

-- Grant permissions to the API user
GRANT CONNECT ON DATABASE "production_database" TO "Endless3686";
GRANT USAGE ON SCHEMA public TO "Endless3686";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "Endless3686";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "Endless3686";

-- Ensure permissions apply to future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "Endless3686";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "Endless3686"; 

-- Create the users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index only if it does not exist
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Explicitly grant privileges on the existing "users" table
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO "Endless3686";
