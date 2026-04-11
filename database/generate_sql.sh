
# * @ Author: Bc. Adam Božek
# * @ Create Time: 2026-01-14 19:52:40
# * @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
#		 It is designed to support the screening of children using the Slovak
#		 implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
# * @ License: This program is free software: you can redistribute it and/or modify it under the terms of
#		 the GNU Affero General Public License as published by the Free Software Foundation, either
#		 version 3 of the License, or any later version. This program is distributed in the hope
#		 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
#		 of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#		 See the GNU Affero General Public License for more details.
#		 You should have received a copy of the GNU Affero General Public License along with this program.
#		 If not, see <https://www.gnu.org/licenses/>..

#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PARENT_DIR/database/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found in parent directory: $ENV_FILE"
    exit 1
fi

echo "Loading environment from: $ENV_FILE"
export $(grep -v '^#' "$ENV_FILE" | xargs)

cd "$SCRIPT_DIR"

envsubst '${POSTGRES_USER} ${POSTGRES_PASSWORD} ${POSTGRES_DB} ${APP_USER} ${APP_PASSWORD}' < init.template.sql > init.sql


echo "Generated init.sql successfully"
