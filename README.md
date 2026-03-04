# Masters Thesis

> A brief description or tagline for your project.

---

## Overview

**Project Title** is a web application that [briefly describe the purpose and functionality of the app, e.g., "allows users to track tasks and organize projects in a collaborative environment"].

## Tech Stack s

- **Frontend**: React ( using NextJS ), HTML, CSS, JavaScript, Bootstrap
- **Backend**: Python ( Flask )
- **Database**: PostgreSQL
- **Others**: Docker

## Features

- [Feature 1, e.g., User Authentication and Authorization]
- [Feature 2, e.g., Real-time Notifications]
- [Feature 3, e.g., RESTful API for CRUD Operations]
- [Feature 4, e.g., Dashboard Analytics]
- ...

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (version X.X.X)
- [Python](https://www.python.org/) (version X.X.X)
- [Database System, e.g., PostgreSQL](https://www.postgresql.org/) installed and running
- Pictures (not available in this repo) FIXME: make them available and share the link early

### Setup Instructions

1. **Clone the Repository**

   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

2. **Install Frontend Dependencies**

   ```bash
   cd frontend
   npm install
   ```

3. **Install Backend Dependencies**

   ```bash
   cd ../backend
   pip install -r requirements.txt
   ```

## Usage

### Running the Frontend

```bash
cd frontend
npm start
```

This will start the React app on `http://localhost:3000`.

### Running the Backend

```bash
cd backend
python app.py
```

This will start the backend server on `http://localhost:5000`.

## License

This project is licensed under the GNU AGPL v3 License - see the [LICENSE](LICENSE) file for details.

## Contact

If you have any questions don't hesitate to contact me:
[Adam Božek](mailto:b0zek.adm@gmail.com)

## HTTPS Recovery after `docker compose down -v`

### 1. Put Nginx back to HTTP-only bootstrap config

Nastavte subor `./nginx/conf.d/default.conf` na:

```
server {
listen 80;
listen [::]:80;
server_name tekos.3pocube.fei.tuke.sk;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/_letsencrypt;
    }

    location /api/ {
        proxy_pass http://backend:5000;
    }

    location / {
        proxy_pass http://frontend:3000;
    }
}
```

### 2. Bring the stack up (recreates volumes)

```bash
docker compose up -d --build 3) Re-issue the Let’s Encrypt certificate
docker compose run --rm certbot certonly \
 --webroot -w /var/www/\_letsencrypt \
 -d tekos.3pocube.fei.tuke.sk \
 --email adam.bozek@student.tuke.sk \
 --agree-tos --no-eff-email 4) Switch Nginx config back to HTTPS and reload
```

Vymenit subor `./nginx/conf.d/default.conf` na povodnu verziu (ctrl+z) a spustit

```bash
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```
