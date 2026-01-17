#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PARENT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found in parent directory: $ENV_FILE"
    exit 1
fi

echo "Loading environment from: $ENV_FILE"
export $(grep -v '^#' "$ENV_FILE" | xargs)

cd "$SCRIPT_DIR"

envsubst '${POSTGRES_USER} ${POSTGRES_PASSWORD} ${POSTGRES_DB} ${APP_USER} ${APP_PASSWORD}' < init.template.sql > init.sql


echo "Generated init.sql successfully"
