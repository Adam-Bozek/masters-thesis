-- init.template.sql

-- Check if the user exists before creating it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_API_USER}') THEN
        CREATE USER "${PG_API_USER}" WITH ENCRYPTED PASSWORD '${PG_API_PASSWORD}';
    END IF;
END $$;

-- Ensure the admin user has full privileges
ALTER ROLE "${PG_ADMIN_USER}" WITH SUPERUSER;

-- Grant permissions to the API user
GRANT CONNECT ON DATABASE "${PG_DATABASE}" TO "${PG_API_USER}";
GRANT USAGE ON SCHEMA public TO "${PG_API_USER}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${PG_API_USER}";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${PG_API_USER}";

-- Ensure permissions apply to future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${PG_API_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${PG_API_USER}";

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

-- STATIC categories (no per-session data here)
CREATE TABLE IF NOT EXISTS test_categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    question_count INTEGER NOT NULL
);

-- Populate once
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

CREATE TABLE IF NOT EXISTS session_test_categories (
    session_id INTEGER NOT NULL REFERENCES user_test_sessions(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES test_categories(id),

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    was_corrected BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (session_id, category_id)
);

-- Answers to each question in a session
CREATE TABLE IF NOT EXISTS user_test_answers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,

    question_number INTEGER NOT NULL,
    answer_state TEXT CHECK (
        answer_state IN ('1', '2', '3', 'true', 'false')
    ) NOT NULL,
    user_answer TEXT,
    answered_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_session_category
        FOREIGN KEY (session_id, category_id)
        REFERENCES session_test_categories (session_id, category_id)
        ON DELETE CASCADE,

    UNIQUE (session_id, category_id, question_number)
);

-- Create index only if it does not exist
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Explicitly grant privileges on the tables
GRANT SELECT, INSERT, UPDATE, DELETE ON
    users,
    test_categories,
    user_test_sessions,
    session_test_categories,
    user_test_answers
TO "${PG_API_USER}";
