# ---------- Build ----------
FROM node:25.6.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build


# ---------- Runtime ----------
FROM nginx:1.29.5-alpine-slim

# Install Node + tini on Alpine
# (use apk; no DEBIAN_FRONTEND; no apt-get; no glibc tarballs)
RUN apk add --no-cache nodejs npm tini

WORKDIR /app

# nginx config (compose bind-mount can override)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# app files
COPY --from=build /app /app

ENV NODE_ENV=production
EXPOSE 80 443 3000

# Run Next in background and nginx in foreground; tini handles signals properly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-lc", "npm run start -- -H 0.0.0.0 -p 3000 & next_pid=$!; nginx -g 'daemon off;' & nginx_pid=$!; wait -n $next_pid $nginx_pid"]