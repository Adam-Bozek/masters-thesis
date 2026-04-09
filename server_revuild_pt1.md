# Production Server Documentation

## 1. Server Overview

The production server runs Ubuntu 24.04.4 LTS on a VMware virtual machine with Linux kernel 6.8.0-106-generic and x86-64 architecture. The deployment project is located under `/root/masters-thesis`.

## 2. Deployment Model

The application is deployed as a Docker Compose stack. The active containers are:

- `frontend`
- `backend`
- `nginx`
- `postgres`
- `redis`

A `certbot` container also exists, but it is not continuously running; it is invoked on demand for certificate renewal. Current container status shows the main application containers are up and healthy, while `certbot` is exited. :contentReference[oaicite:2]{index=2}

The Compose definition includes:

- PostgreSQL database container using image `postgres:18.1-alpine`
- Redis cache container using image `redis:8.6.1-alpine`
- Backend container built from `backend/backend.dockerfile`
- Frontend container built from `frontend/frontend.dockerfile`
- Nginx reverse proxy using image `nginx:1.29.6-alpine-slim`
- Certbot container using image `certbot/certbot` under a manual profile.

## 3. Networking and Exposure

The public entry point is the `nginx` container. It publishes:

- port 80/tcp
- port 443/tcp

The frontend is exposed internally on port 3000, the backend listens internally on port 5000, PostgreSQL on 5432, and Redis on 6379. The Compose network is `masters-thesis_app`, backed by a bridge network.

## 4. Persistent Storage

The Compose stack defines persistent volumes for:

- PostgreSQL data
- Redis data
- TLS certificate data
- Let's Encrypt webroot challenge data

Named volumes visible on the server include `masters-thesis_postgres_data`, `masters-thesis_redis_data`, `masters-thesis_certs`, and `masters-thesis_letsencrypt_webroot`.

## 5. Configuration Layout

The main deployment files are stored in `/root/masters-thesis`. Relevant configuration paths include:

- `/root/masters-thesis/docker-compose.yml`
- `/root/masters-thesis/nginx/nginx.conf`
- `/root/masters-thesis/nginx/conf.d/default.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/security.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/letsencrypt.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/proxy.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/general.conf`

Environment files are present at:

- `/root/masters-thesis/.env`
- `/root/masters-thesis/frontend/.env`
- `/root/masters-thesis/backend/.env`
- `/root/masters-thesis/database/.env`

## 6. Certificate Management

Certificate management is not handled by a host-installed Certbot package. On the host, `certbot` is not installed, and neither `certbot.timer` nor `certbot.service` exists. :contentReference[oaicite:7]{index=7}

TLS renewal is handled through Docker Compose by a root cron job. Every day at 03:00, the server runs:

`docker compose -f /root/masters-thesis/docker-compose.yml run --rm certbot renew --webroot -w /var/www/_letsencrypt --quiet`

After renewal, nginx is reloaded with a HUP signal through Docker Compose. :contentReference[oaicite:8]{index=8}

The Compose file confirms that:

- `nginx` mounts the certificate volume at `/etc/letsencrypt` read-only
- `nginx` mounts the ACME webroot at `/var/www/_letsencrypt`
- `certbot` mounts the same certificate and webroot volumes
- the `certbot` service is intended for manual execution via Compose profile `manual`. :contentReference[oaicite:9]{index=9}

This means HTTPS certificate issuance and renewal are containerized, not managed directly by the host OS.

## 7. Scheduled Tasks

The root crontab contains two custom jobs:

1. Daily at 03:00: renew Let's Encrypt certificates using the Docker `certbot` container and reload nginx.
2. Monthly on day 1 at 03:30: prune Docker builder cache with a 720-hour retention threshold using `docker builder prune`. :contentReference[oaicite:11]{index=11}

There are no additional custom crontabs for other system users in the uploaded output. Standard system cron directories exist, including `/etc/cron.d`, `/etc/cron.daily`, and `/etc/cron.weekly`. :contentReference[oaicite:12]{index=12}

System timers also handle standard maintenance tasks such as `apt-daily.timer`, `apt-daily-upgrade.timer`, `logrotate.timer`, `fstrim.timer`, and others.

## 8. Automatic Security Updates

Automatic security updates are enabled through the `unattended-upgrades` package, which is installed on the server. The APT periodic configuration enables package list refresh and unattended upgrades. :contentReference[oaicite:14]{index=14}

The allowed unattended upgrade origins include:

- the base Ubuntu release
- the Ubuntu security pocket
- Ubuntu ESM application security
- Ubuntu ESM infrastructure security

The standard `-updates`, `-proposed`, and `-backports` pockets are commented out in the shown configuration. :contentReference[oaicite:15]{index=15}

The `unattended-upgrades.service` unit is enabled and active. Recent APT history shows unattended upgrades have installed or upgraded packages automatically, including timezone data, Python packages, archive libraries, and Linux kernel packages. Old kernel packages were also removed automatically.

## 9. Enabled Services Relevant to Production

The systemd configuration paths show that `docker.service`, `containerd.service`, `cron.service`, `ufw.service`, and `unattended-upgrades.service` are enabled in the multi-user target. This indicates Docker, cron, firewall, and unattended updates are configured to start automatically on boot.

## 10. Rebuild Procedure for a New Production Server

1. Install Ubuntu 24.04 LTS.
2. Install Docker Engine and Docker Compose plugin.
3. Copy the project to `/root/masters-thesis` or another chosen deployment path.
4. Restore all required `.env` files for root, frontend, backend, and database configuration.
5. Restore or recreate the Nginx configuration files under the project’s `nginx` directory.
6. Start the Compose stack so that PostgreSQL, Redis, backend, frontend, and nginx are running.
7. Ensure the Docker volumes for database data, Redis data, certificate storage, and ACME webroot exist or are restored from backup.
8. Recreate the root cron job that runs daily certificate renewal through the Docker `certbot` container and reloads nginx after renewal.
9. Recreate the monthly Docker builder prune cron job.
10. Enable unattended upgrades by installing `unattended-upgrades` and setting `APT::Periodic::Update-Package-Lists "1";` and `APT::Periodic::Unattended-Upgrade "1";`.
11. Verify that Docker, cron, firewall, and unattended-upgrades services are enabled at boot.

## 11. Known Gaps

This documentation captures the current operational state, not the full historical change history. It does not include secret values from `.env` files, backup contents of Docker volumes, database credentials, DNS provider details, or the exact command history originally used to build the server. Those items must be documented separately.
