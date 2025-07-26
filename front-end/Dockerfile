# 1. Build Phase
FROM node:current-alpine3.20 AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project files
COPY . .

# Build the Next.js application
RUN npm run build

# 2. Production Phase
FROM node:current-alpine3.20 AS production

# Set working directory
WORKDIR /app

# Copy only the necessary files from the build phase
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

# Set environment variable to production
ENV NODE_ENV=production

# Expose the default Next.js port
EXPOSE 80

# Start the Next.js application
CMD ["npm", "run", "start"]
