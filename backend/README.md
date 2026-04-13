# Backend

Backend service for the **TEKOS II screening web application** developed as part of a master’s thesis. The API is responsible for user authentication, screening session management, answer storage, category completion workflow, guest access, Redis-based token revocation, and PDF export of completed screening data.

## Overview

The backend is built with **Flask** and exposes a REST API under the `/api` prefix. It works with:

- **PostgreSQL** for persistent application data
- **Redis** for JWT token blocklisting during logout/logout-all flows
- **PyPDF / custom PDF utilities** for filling the TEKOS form and exporting a final PDF

The service is started through `run.py`, which creates the Flask app using `create_app()`.

## Tech stack

- Python
- Flask
- Flask-SQLAlchemy
- Flask-JWT-Extended
- Flask-Bcrypt
- Flask-CORS
- PostgreSQL (`psycopg2-binary`)
- Redis
- Gunicorn
- PyPDF

Dependencies are defined in `requirements.txt`.

## Project structure

```text
backend/
├── app/
│   ├── routes/
│   │   ├── auth_routes.py
│   │   └── test_sessions_routes.py
│   ├── __init__.py
│   ├── config.py
│   ├── form_fill.py
│   ├── models.py
│   ├── redis_utils.py
│   ├── routes_config.py
│   ├── session_pdf_export.py
│   └── TEKOS_w_form.pdf
├── backend.dockerfile
├── requirements.txt
├── run.py
└── README.md
```

## Main features

### 1. Authentication and authorization

The backend provides classic JWT-based authentication for registered users:

- user registration
- login
- access token refresh
- logout of current access token
- logout of current refresh token
- logout from all devices/sessions by incrementing `token_version`
- current user lookup (`/me`)

Passwords are hashed with **Flask-Bcrypt**.

### 2. Screening session management

For authenticated users, the API supports:

- creating a new screening session
- listing sessions for the logged-in user
- reading a specific session
- updating session metadata (`note`)
- manually completing a session
- listing categories for a session
- completing individual categories
- marking a category as corrected
- storing and updating answers per category/question
- listing all saved answers for a session

### 3. Guest session flow

The backend also supports **guest sessions** without account registration.

Guest sessions:

- are created through a dedicated endpoint
- receive a generated `public_id` and `guest_token`
- are accessed using the `X-Guest-Token` request header
- expire after inactivity
- are refreshed on activity by updating `last_activity_at` and `expires_at`
- are cleaned up when expired guest sessions are checked

This allows temporary anonymous use of the screening workflow.

### 4. Automatic completion logic

A session category can be completed independently. When **all standard categories** are completed, the session itself is automatically marked as completed.

The standard workflow currently uses category IDs `1` through `5`.

### 5. PDF export

The backend can generate a filled PDF export of a screening session.

The export flow:

- loads the TEKOS PDF template
- maps saved answers to PDF form fields
- supports form overrides
- can read questionnaire payloads either from JSON in the request body or uploaded `.json` files in multipart form data
- returns the generated file as a downloadable PDF response

The export logic is implemented mainly in:

- `session_pdf_export.py`
- `form_fill.py`

## Environment variables

Create a `backend/.env` file.

### Required

```env
REDIS_PASSWORD=
JWT_SECRET_KEY=
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_HOST=
DB_PORT=
```

### Supported optional variables

```env
JWT_ALGORITHM=HS512
JWT_ACCESS_MINUTES=15
JWT_REFRESH_DAYS=30
SQLALCHEMY_ECHO=true
REDIS_URL=
REDIS_HOST=cache
REDIS_PORT=6379
```

## Local development

### 1. Create a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Prepare environment variables

Create `backend/.env` and fill in database, JWT, and Redis settings.

### 4. Run the API

From the `backend/` directory:

```bash
python run.py
```

The Flask app starts from `run.py` and serves the API on port `5000` by default.

## Docker

The repository is configured to run the backend together with PostgreSQL and Redis via Docker Compose.

Relevant services:

- `database` – PostgreSQL
- `cache` – Redis
- `backend` – Flask/Gunicorn API

The backend container:

- builds from `backend/backend.dockerfile`
- installs dependencies from `backend/requirements.txt`
- copies the backend source into `/app`
- copies `frontend/public/data` into the image so PDF export can access questionnaire JSON files
- starts with Gunicorn on port `5000`

### Build and run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

## Configuration details

### Database

The backend uses SQLAlchemy with PostgreSQL:

- connection string is built from `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `DB_NAME`
- `pool_pre_ping` is enabled
- query recording is enabled
- track modifications is disabled

### Redis

Redis is used for JWT revocation/blocklisting.

When a token is logged out, its JWT `jti` is stored in Redis with TTL matching the token’s remaining lifetime. Requests then check whether the token is blocklisted.

### CORS

CORS is enabled globally for the Flask app.

## Data model

The backend works with these SQLAlchemy models:

- `User`
- `TestCategory`
- `UserTestSession`
- `SessionTestCategory`
- `UserTestAnswer`

At a high level:

- a user can have many test sessions
- a session contains multiple categories
- each category in a session can have many answers
- answers are unique per `(session_id, category_id, question_number)`
- guest sessions are stored in the same session table and distinguished by `is_guest`

## API routes

All routes are registered under the `/api` prefix.

### Auth routes

| Method | Route                  | Description                                           |
| ------ | ---------------------- | ----------------------------------------------------- |
| POST   | `/api/register`        | Register a new user                                   |
| POST   | `/api/login`           | Log in and receive access + refresh tokens            |
| POST   | `/api/refresh`         | Create a new access token from refresh token          |
| POST   | `/api/logout`          | Revoke current access token                           |
| POST   | `/api/logout-refresh`  | Revoke current refresh token                          |
| POST   | `/api/logout-all`      | Invalidate all user sessions by bumping token version |
| GET    | `/api/me`              | Return current authenticated user                     |
| GET    | `/api/test`            | Protected test route                                  |
| GET    | `/api/health`          | Basic health endpoint                                 |
| GET    | `/api/db_cache_health` | Database + Redis health status                        |

### Session routes

| Method | Route                                                          | Description                       |
| ------ | -------------------------------------------------------------- | --------------------------------- |
| POST   | `/api/sessions`                                                | Create authenticated user session |
| GET    | `/api/sessions`                                                | List authenticated user sessions  |
| POST   | `/api/sessions/guest`                                          | Create guest session              |
| GET    | `/api/sessions/<session_id>`                                   | Get session details               |
| PATCH  | `/api/sessions/<session_id>`                                   | Update session note/data          |
| PATCH  | `/api/sessions/<session_id>/complete`                          | Complete session                  |
| POST   | `/api/sessions/<session_id>/answers`                           | Create or update answer           |
| GET    | `/api/sessions/<session_id>/answers`                           | List session answers              |
| GET    | `/api/sessions/<session_id>/categories`                        | List session categories           |
| PATCH  | `/api/sessions/<session_id>/categories/<category_id>/complete` | Complete category                 |
| PATCH  | `/api/sessions/<session_id>/categories/<category_id>/correct`  | Mark category as corrected        |
| POST   | `/api/sessions/export-pdf`                                     | Export session as filled PDF      |

## Authentication model

### Registered users

Authenticated endpoints use JWT Bearer authorization.

Typical flow:

1. `POST /api/login`
2. store access token and refresh token
3. send access token in `Authorization: Bearer <token>`
4. refresh access token through `POST /api/refresh` when needed

### Guest users

Guest access uses:

- guest session ID in the URL
- guest token in `X-Guest-Token`

This allows access to the guest’s own temporary session without a full account.

## Answer format

When saving answers, the API accepts these `answer_state` values:

- `"1"`
- `"2"`
- `"3"`
- `"true"`
- `"false"`

The optional `user_answer` field can store a custom textual answer.

## Health checks

The backend provides two useful health endpoints:

- `/api/health` → returns `OK`
- `/api/db_cache_health` → checks PostgreSQL and Redis availability

These endpoints are also used by Docker health checks.

## Notes for integration

- Guest session requests must include `X-Guest-Token`
- PDF export requires an existing accessible session and at least one saved answer
- For authenticated PDF export, the provided `user_id` must match the logged-in user
- The backend depends on questionnaire JSON files used by the frontend for PDF generation and category/question mapping
