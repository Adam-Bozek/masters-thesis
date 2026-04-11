# Admin User

POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

# API user

APP_USER=
APP_PASSWORD=

you can get to the databse by using command `docker compose exec database psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
