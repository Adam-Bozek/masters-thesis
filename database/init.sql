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
    token_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store the fixed test categories
CREATE TABLE IF NOT EXISTS test_categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    question_count INTEGER NOT NULL
);

-- Populate the test categories (one-time insert)
INSERT INTO test_categories (name, question_count) VALUES
  ('Marketplace', 16),
  ('Mountains', 8),
  ('Zoo', 11),
  ('Home', 24),
  ('Street', 12),
  ('Parent_answerd', 25)
ON CONFLICT (name) DO NOTHING;

-- A session of test taken by a user
CREATE TABLE IF NOT EXISTS user_test_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Answers to each question in a session
CREATE TABLE IF NOT EXISTS user_test_answers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES user_test_sessions(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES test_categories(id),
    question_number INTEGER NOT NULL, -- 1-based index
    answer_state TEXT CHECK (
        answer_state IN ('1', '2', '3', 'true', 'false')
    ) NOT NULL,
    user_answer TEXT,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Enforce unique answer per question per session+category
    UNIQUE (session_id, category_id, question_number)
);


-- Create index only if it does not exist
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Explicitly grant privileges on the tables
GRANT SELECT, INSERT, UPDATE, DELETE ON 
    test_categories, 
    user_test_sessions, 
    user_test_answers 
TO "app_user";

