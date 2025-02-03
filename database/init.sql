-- Check if the user exists before creating it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE USER "app_user" WITH ENCRYPTED PASSWORD 'secret_password';
    END IF;
END $$;

-- Ensure the admin user has full privileges
ALTER ROLE "admin_user" WITH SUPERUSER;

-- Grant permissions to the API user
GRANT CONNECT ON DATABASE "production_database" TO "app_user";
GRANT USAGE ON SCHEMA public TO "app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "app_user";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "app_user";

-- Ensure permissions apply to future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "app_user"; 

-- Create the users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index only if it does not exist
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Explicitly grant privileges on the existing "users" table
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO "app_user";
