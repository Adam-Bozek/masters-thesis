# * @ Author: Bc. Adam Božek
# * @ Create Time: 2025-10-24 18:43:51
# * @ Description: 	This repository contains a full-stack application suite developed within a master’s thesis.
#	    It is designed to support the screening of children using the Slovak
#	    implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
# * @ License: 	This program is free software: you can redistribute it and/or modify it under the terms of
#	    the GNU Affero General Public License as published by the Free Software Foundation, either
#	    version 3 of the License, or any later version. This program is distributed in the hope
#	    that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
#   	of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#     See the GNU Affero General Public License for more details.
#	    You should have received a copy of the GNU Affero General Public License along with this program.
#	    If not, see <https://www.gnu.org/licenses/>.


# ---------- Build ----------
FROM node:25.8.1-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Runtime ----------
FROM node:25.8.1-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-lc", "npm run start -- -H 0.0.0.0 -p 3000"]