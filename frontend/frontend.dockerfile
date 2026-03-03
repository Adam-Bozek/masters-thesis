# ---------- Build ----------
FROM node:25.6.1-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Runtime ----------
FROM node:25.6.1-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3000
CMD ["sh", "-lc", "npm run start -- -H 0.0.0.0 -p 3000"]