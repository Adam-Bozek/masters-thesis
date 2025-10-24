# ---------- Build Phase ----------
FROM node:24.9-bookworm AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---------- Production Phase ----------
FROM nginx:1.29.2-alpine

# Copy Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install Node.js for Next.js runtime
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy app files
COPY --from=build /app ./

ENV NODE_ENV=production

EXPOSE 80

# Run both Next.js and Nginx
CMD ["sh", "-c", "npm run start -- -p 3000 & nginx -g 'daemon off;'"]

