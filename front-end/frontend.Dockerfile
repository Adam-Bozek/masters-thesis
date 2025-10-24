# ---------- Build Phase ----------
FROM node:25.0.0-trixie AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---------- Production Phase ----------
FROM nginx:1.29.2-trixie

# Copy Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install Node.js for Next.js runtime
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy app files
COPY --from=build /app ./

ENV NODE_ENV=production

EXPOSE 80

# Run both Next.js and Nginx
CMD ["sh", "-c", "npm run start -- -p 3000 & nginx -g 'daemon off;'"]

