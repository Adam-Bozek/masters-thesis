# 1. Fáza: Build fáza, používa Node.js
FROM node:latest  AS build

# Nastavíme pracovný adresár vo vnútri kontajnera
WORKDIR /front-end

# Skopírujeme package.json a package-lock.json do kontajnera
COPY package*.json ./

# Inštalujeme závislosti
RUN npm install

# Skopírujeme všetky súbory projektu do kontajnera
COPY . .

# Zostavíme React aplikáciu (build)
RUN npm run build

# 2. Fáza: Produkčná fáza, použijeme Nginx
FROM nginx:latest

# Skopírujeme z build fázy (z priečinka /app/build) do Nginx priečinka
COPY --from=build /app/build /usr/share/nginx/html

# Exponujeme port 80 pre Nginx
EXPOSE 80

# Spustíme Nginx v predvoleného režime (ako daemon off)
CMD ["nginx", "-g", "daemon off;"]