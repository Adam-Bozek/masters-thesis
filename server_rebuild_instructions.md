# Production Server Bring-Up Guide

This guide describes the order for bringing the production server online for the **Masters Thesis** project. It is based on the current deployment layout: Docker Compose in `/root/masters-thesis`, Nginx as the public entry point, containerized Certbot for TLS, and host-level unattended security updates.

## 1. Scope

Use this guide when:

- provisioning a new Ubuntu server
- rebuilding production after a full shutdown
- recovering HTTPS after `docker compose down -v`
- re-creating cron-based operational tasks
- restoring automatic security updates

This guide assumes:

- Ubuntu 24.04 LTS
- project path: `/root/masters-thesis`
- compose file: `/root/masters-thesis/docker-compose.yml`
- Nginx config file: `/root/masters-thesis/nginx/conf.d/default.conf`
- public domain: `tekos.3pocube.fei.tuke.sk`

---

## 2. Service layout

The Docker stack consists of:

- `frontend`
- `backend`
- `nginx`
- `postgres`
- `redis`
- `certbot` used only when needed

Nginx publishes ports `80` and `443`. Persistent Docker volumes are used for PostgreSQL data, Redis data, certificate storage, and the Let's Encrypt webroot.

---

## 3. Step 1: Prepare the server

Install the packages required for Docker repository setup, cron, and unattended security updates.

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg cron unattended-upgrades
```

Enable cron and unattended upgrades:

```bash
sudo systemctl enable cron
sudo systemctl start cron
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
sudo systemctl enable unattended-upgrades
sudo systemctl start unattended-upgrades
```

Basic check:

```bash
systemctl is-active cron
systemctl is-active unattended-upgrades
```

---

## 4. Step 2: Install Docker Engine and Compose plugin

Install Docker using the official Docker repository.

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Enable Docker on boot:

```bash
sudo systemctl enable docker
sudo systemctl start docker
sudo systemctl enable containerd
sudo systemctl start containerd
```

Basic check:

```bash
docker --version
docker compose version
systemctl is-active docker
```

---

## 5. Step 3: Restore the project files

Create the project directory:

```bash
sudo mkdir -p /root/masters-thesis
cd /root/masters-thesis
```

Copy or clone the project so that at minimum these files exist:

- `/root/masters-thesis/docker-compose.yml`
- `/root/masters-thesis/nginx/nginx.conf`
- `/root/masters-thesis/nginx/conf.d/default.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/security.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/letsencrypt.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/proxy.conf`
- `/root/masters-thesis/nginx/nginxconfig.io/general.conf`
- `/root/masters-thesis/.env`
- `/root/masters-thesis/frontend/.env`
- `/root/masters-thesis/backend/.env`
- `/root/masters-thesis/database/.env`

Verify that the Compose file resolves correctly:

```bash
cd /root/masters-thesis
docker compose config > /tmp/masters-thesis.compose.rendered.yml
```

If this command fails, fix missing files or missing environment values before proceeding.

---

## 6. Step 4: Start the application stack

Build and start the stack:

```bash
cd /root/masters-thesis
docker compose up -d --build
```

Check that the main containers are running:

```bash
docker compose ps
docker ps
```

Expected running containers:

- `frontend`
- `backend`
- `nginx`
- `postgres`
- `redis`

The `certbot` container is expected to be stopped unless invoked manually.

If a service is unhealthy, review logs:

```bash
docker compose logs --tail=200 frontend
docker compose logs --tail=200 backend
docker compose logs --tail=200 nginx
docker compose logs --tail=200 database
docker compose logs --tail=200 cache
```

---

## 7. Step 5: Recover HTTPS after `docker compose down -v`

Use this sequence if certificate storage was deleted and HTTPS no longer works.

### 7.1 Put Nginx into temporary HTTP-only bootstrap mode

Edit `/root/masters-thesis/nginx/conf.d/default.conf` and temporarily replace its contents with this bootstrap configuration:

```nginx
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

### 7.2 Start the stack and recreate volumes

```bash
cd /root/masters-thesis
docker compose up -d --build
```

### 7.3 Issue a new Let's Encrypt certificate

Replace the placeholder text `INSERT_EMAIL_HERE` below with valid email address, then run:

```bash
cd /root/masters-thesis
docker compose run --rm certbot certonly \
  --webroot -w /var/www/_letsencrypt \
  -d tekos.3pocube.fei.tuke.sk \
  --email INSERT_EMAIL_HERE \
  --agree-tos --no-eff-email
```

If the command fails:

- verify DNS resolves to the server
- verify port 80 is reachable from the internet
- verify the HTTP-only bootstrap config is active
- verify `nginx` is running

### 7.4 Restore the normal HTTPS Nginx configuration

Replace `/root/masters-thesis/nginx/conf.d/default.conf` with the normal production HTTPS version used by the project.

### 7.5 Test and reload Nginx

```bash
cd /root/masters-thesis
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
curl -I http://tekos.3pocube.fei.tuke.sk
curl -Ik https://tekos.3pocube.fei.tuke.sk
docker compose ps
```

---

## 8. Step 6: Recreate automatic certificate renewal

This server does **not** use host-installed Certbot for renewal. Renewal is done by root cron using the `certbot` Docker container.

Open root crontab:

```bash
sudo crontab -e
```

Add these entries:

```cron
0 3 * * * /usr/bin/docker compose -f /root/masters-thesis/docker-compose.yml run --rm certbot renew --webroot -w /var/www/_letsencrypt --quiet >>/var/log/certbot-renew.log 2>&1 && /usr/bin/docker compose -f /root/masters-thesis/docker-compose.yml kill -s HUP nginx
30 3 1 * * /usr/bin/flock -n /var/run/docker-builder-prune.lock /usr/bin/docker builder prune -af --filter "until=720h" >> /var/log/docker-builder-prune.log 2>&1
```

These jobs do the following:

- daily at 03:00: renew certificates if needed, then reload Nginx
- monthly on day 1 at 03:30: prune old Docker build cache

Check cron setup:

```bash
sudo crontab -l
systemctl is-active cron
```

Optional manual renewal test:

```bash
cd /root/masters-thesis
sudo /usr/bin/docker compose -f /root/masters-thesis/docker-compose.yml run --rm certbot renew --webroot -w /var/www/_letsencrypt
sudo /usr/bin/docker compose -f /root/masters-thesis/docker-compose.yml kill -s HUP nginx
```

---

## 9. Step 7: Verify automatic security updates

The setup for unattended upgrades was already done in Step 1. This step only confirms that the configuration is correct.

Verify the periodic settings:

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
```

Expected contents:

```text
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

Verify the allowed origins in `/etc/apt/apt.conf.d/50unattended-upgrades`:

```bash
grep -A10 "Allowed-Origins" /etc/apt/apt.conf.d/50unattended-upgrades
```

It should contain at least:

```text
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
```

Check service state and optional dry run:

```bash
systemctl status unattended-upgrades --no-pager
sudo unattended-upgrade --dry-run --debug
```

Check update history later if needed:

```bash
cat /var/log/apt/history.log
```

---

## 10. Step 8: Verify Docker volumes and network

Verify named volumes exist:

```bash
docker volume ls
```

Expected project volumes include:

- `masters-thesis_postgres_data`
- `masters-thesis_redis_data`
- `masters-thesis_certs`
- `masters-thesis_letsencrypt_webroot`

Verify Docker network:

```bash
docker network ls
```

Expected project network:

- `masters-thesis_app`

---

## 11. Step 9: Final verification checklist

Run these checks after the server is fully up.

### 11.1 Compose and container health

```bash
cd /root/masters-thesis
docker compose ps
docker ps
```

### 11.2 Nginx syntax and reload path

```bash
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

### 11.3 HTTP and HTTPS reachability

```bash
curl -I http://tekos.3pocube.fei.tuke.sk
curl -Ik https://tekos.3pocube.fei.tuke.sk
```

### 11.4 Certificate renewal and cron presence

```bash
sudo crontab -l
systemctl is-active cron
```

### 11.5 Automatic security updates

```bash
systemctl status unattended-upgrades --no-pager
cat /etc/apt/apt.conf.d/20auto-upgrades
```

### 11.6 Boot persistence

```bash
systemctl is-enabled docker
systemctl is-enabled containerd
systemctl is-enabled cron
systemctl is-enabled unattended-upgrades
```

All should report `enabled`.

---

## 12. Routine operations

### Start the full stack

```bash
cd /root/masters-thesis
docker compose up -d
```

### Rebuild and restart after code changes

```bash
cd /root/masters-thesis
docker compose up -d --build
```

### Stop the stack without deleting volumes

```bash
cd /root/masters-thesis
docker compose down
```

### Stop the stack and delete volumes

```bash
cd /root/masters-thesis
docker compose down -v
```

Warning: `docker compose down -v` removes persistent volumes, including certificate storage. After that, use the HTTPS recovery procedure from section 7.

### View logs

```bash
cd /root/masters-thesis
docker compose logs --tail=200 -f
```

---

## 13. Failure cases and direct fixes

### Problem: Nginx is up but HTTPS fails

- Check whether certificate files still exist in the `certs` volume.
- If volumes were removed, follow section 7 exactly.
- Validate Nginx config with `docker compose exec nginx nginx -t`.

### Problem: Certbot renewal does not work

- Check `sudo crontab -l`.
- Check `/var/log/certbot-renew.log`.
- Run the renewal command manually.
- Verify port 80 is reachable and the ACME path is served.

### Problem: Security updates are not happening

- Check `systemctl status unattended-upgrades`.
- Check `/etc/apt/apt.conf.d/20auto-upgrades`.
- Check `/var/log/apt/history.log` for unattended-upgrade runs.

### Problem: Containers do not start after reboot

- Check `systemctl status docker`.
- Check `docker ps -a`.
- Restart the stack with `docker compose up -d` from `/root/masters-thesis`.

---

## 14. Minimal bring-up sequence

For a fast rebuild, use this order:

1. Prepare the server and install Docker.
2. Restore `/root/masters-thesis` and all `.env` files.
3. Run `docker compose up -d --build`.
4. If certificates are missing, switch Nginx to HTTP-only bootstrap mode.
5. Run the Certbot issuance command.
6. Restore normal HTTPS Nginx config.
7. Test and reload Nginx.
8. Add the root cron jobs.
9. Verify unattended upgrades.
10. Confirm HTTP, HTTPS, and container health.
