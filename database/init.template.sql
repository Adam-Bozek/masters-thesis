DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_USER}') THEN
        CREATE USER "${APP_USER}" WITH ENCRYPTED PASSWORD '${APP_PASSWORD}';
    END IF;
END $$;

ALTER ROLE "${POSTGRES_USER}" WITH SUPERUSER;

GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${APP_USER}";
GRANT USAGE ON SCHEMA public TO "${APP_USER}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_USER}";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${APP_USER}";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${APP_USER}";

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    question_count INTEGER NOT NULL
);

INSERT INTO test_categories (name, question_count) VALUES
  ('Marketplace', 16),
  ('Mountains', 7),
  ('Zoo', 11),
  ('Street', 13),
  ('Home', 25),
  ('Parent_answerd', 25)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_test_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    note TEXT,
    public_id TEXT,
    guest_token TEXT,
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS user_test_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS user_test_sessions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE IF EXISTS user_test_sessions ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE IF EXISTS user_test_sessions ADD COLUMN IF NOT EXISTS guest_token TEXT;
ALTER TABLE IF EXISTS user_test_sessions ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS user_test_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS user_test_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_test_sessions_public_id ON user_test_sessions(public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_test_sessions_guest_token ON user_test_sessions(guest_token) WHERE guest_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_test_sessions_is_guest ON user_test_sessions(is_guest);
CREATE INDEX IF NOT EXISTS idx_user_test_sessions_last_activity_at ON user_test_sessions(last_activity_at);

CREATE TABLE IF NOT EXISTS session_test_categories (
    session_id INTEGER NOT NULL REFERENCES user_test_sessions(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES test_categories(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    was_corrected BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (session_id, category_id)
);

CREATE TABLE IF NOT EXISTS user_test_answers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    question_number INTEGER NOT NULL,
    answer_state TEXT CHECK (answer_state IN ('1', '2', '3', 'true', 'false')) NOT NULL,
    user_answer TEXT,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_session_category
        FOREIGN KEY (session_id, category_id)
        REFERENCES session_test_categories (session_id, category_id)
        ON DELETE CASCADE,
    UNIQUE (session_id, category_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON
    users,
    test_categories,
    user_test_sessions,
    session_test_categories,
    user_test_answers
TO "${APP_USER}";
