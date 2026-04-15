# TEKOS II Screening Web Application

Master’s thesis project focused on supporting the screening of children’s communication abilities using the Slovak short version of the TEKOS II screening instrument.

The repository contains a full-stack web application with a Next.js frontend, a Flask REST API, PostgreSQL for persistent storage, Redis for token/session support, and Nginx for reverse proxying in the deployment environment.

You can view working version at https://tekos.3pocube.fei.tuke.sk

## Overview

The application was created as part of a diploma thesis and is designed to simplify the digital workflow around TEKOS II-based screening. It supports both authenticated and anonymous usage, stores screening progress, allows answer correction, and can export completed screening sessions to PDF.

The project is split into several parts:

- **frontend/** – user interface built in Next.js, React, and TypeScript
- **backend/** – Flask API for authentication, sessions, answers, and PDF export
- **database/** – PostgreSQL initialization template and SQL generation tools
- **nginx/** – reverse proxy and TLS configuration for deployment
- **tools/** – scripts for preparing image assets used by testing JSON files

## Main Features

- User registration and login
- Guest mode without account creation
- Demo mode for simplified local presentation
- Category-based screening workflow
- Session progress tracking
- Session notes for authenticated users
- Correction of completed category answers
- PDF export of completed screening sessions
- JSON-driven test content and scene configuration

## User Flows

### 1. Public landing page

The public homepage provides multiple entry points into the application:

- **Prihlásenie** – login for registered users
- **Registrácia** – account creation
- **Demo** – simplified demonstration flow
- **Bez registrácie** – guest screening flow without registration
- **Info** – additional information and reference material

### 2. Authenticated workflow

After login, the user is redirected to the dashboard, where they can:

- view their existing sessions
- continue unfinished sessions
- open the next test category
- add notes to a session
- correct completed categories
- export results to PDF

### 3. Guest workflow

Guest users can complete the screening flow without creating an account. Their session is handled temporarily through a guest token and local browser storage. This makes it possible to test or use the application in a lightweight way without persisting a full user account.

### 4. Demo workflow

The demo route runs a simplified, presentation-oriented version of the application using separate local JSON files.

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Bootstrap / React-Bootstrap
- Axios
- react-speech-recognition

### Backend

- Python
- Flask
- Flask-SQLAlchemy
- Flask-JWT-Extended
- Flask-Bcrypt
- Flask-CORS
- Gunicorn
- PyPDF

### Infrastructure

- PostgreSQL
- Redis
- Docker Compose
- Nginx
- Certbot

## Repository Structure

```text
masters-thesis/
├── backend/                    # Flask API
│   ├── app/
│   ├── backend.dockerfile
│   ├── requirements.txt
│   ├── run.py
│   └── README.md
├── database/                   # PostgreSQL init template and generator
│   ├── generate_sql.sh
│   ├── init.template.sql
│   └── README.md
├── frontend/                   # Next.js frontend
│   ├── public/
│   ├── src/
│   ├── frontend.dockerfile
│   ├── package.json
│   └── README.md
├── nginx/                      # Reverse proxy and TLS config
├── tools/                      # Asset preparation scripts
├── docker-compose.yml
├── server_rebuild_instructions.md
└── LICENSE
```

## Local Development

For local development, it is best to run the frontend and backend directly instead of starting the full production-style Docker stack. The default Nginx configuration is tied to the production domain and expects existing Let’s Encrypt certificates.

### Prerequisites

- Node.js and npm
- Python 3 and pip
- PostgreSQL
- Redis

### Environment Variables

#### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

This value is required because the frontend Axios instance uses `NEXT_PUBLIC_API_URL` as its API base URL.

#### Backend

Create `backend/.env`:

```env
REDIS_PASSWORD=
JWT_SECRET_KEY=
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_HOST=
DB_PORT=

JWT_ALGORITHM=HS512
JWT_ACCESS_MINUTES=15
JWT_REFRESH_DAYS=30
SQLALCHEMY_ECHO=true
REDIS_URL=
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Database

Create `database/.env`:

```env
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
APP_USER=
APP_PASSWORD=
```

### Running the Backend Locally

1. Create and activate a virtual environment:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Make sure PostgreSQL and Redis are running and that `backend/.env` points to them.

4. Start the API:

```bash
python run.py
```

The backend runs on `http://localhost:5000` by default and exposes its routes under the `/api` prefix.

### Running the Frontend Locally

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the development server:

```bash
npm run dev
```

The frontend runs on `http://localhost:3000` by default.

> Recommended browser: **Google Chrome**

### Database Initialization

If you want to prepare the PostgreSQL initialization script used by Docker Compose, generate `database/init.sql` from the template:

```bash
cd database
chmod +x generate_sql.sh
./generate_sql.sh
```

This script loads values from `database/.env` and creates the final `init.sql` used during PostgreSQL container initialization.

## Deployment / Docker Compose

The repository also contains a deployment-oriented Docker Compose setup with these services:

- `database` – PostgreSQL
- `cache` – Redis
- `backend` – Flask / Gunicorn API
- `frontend` – Next.js application
- `nginx` – public reverse proxy
- `certbot` – manual TLS certificate operations

This setup is intended for the deployment environment rather than quick local development. The current Nginx configuration is bound to the domain:

```text
tekos.3pocube.fei.tuke.sk
```

and expects Let’s Encrypt certificate files to be present.

A deployment-style startup is done from the repository root with:

```bash
docker compose up -d --build
```

The production bring-up guide also expects deployment-specific environment files to be present, including repository-level and frontend environment files where applicable.

For full server bring-up, HTTPS recovery, cron-based certificate renewal, and operational maintenance, use:

- [`server_rebuild_instructions.md`](./server_rebuild_instructions.md)

## Notes

- The frontend stores test content and scene configuration in JSON files under `frontend/public/data/`.
- The backend copies `frontend/public/data` into the backend container so the PDF export workflow can access questionnaire data.
- The project includes helper scripts in `tools/` for converting and renaming image assets used by the testing JSON files.

## License

This project is licensed under the **GNU Affero General Public License v3.0**. See the [LICENSE](./LICENSE) file for details.

## Author

**Bc. Adam Božek**
