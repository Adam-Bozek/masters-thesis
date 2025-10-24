# ---------- Build Phase ----------
FROM node:25.0.0-trixie AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---------- Production Phase ----------
FROM nginx:1.29.2-trixie

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install Node.js to run Next.js
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app ./

ENV NODE_ENV=production
EXPOSE 80 3000

# Start Next.js first, wait for it, then start Nginx
CMD sh -c "npm run start -- -H 0.0.0.0 -p 3000 & \
  echo 'Waiting for Next.js...' && sleep 5 && \
  nginx -g 'daemon off;'"
