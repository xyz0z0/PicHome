#!/bin/sh
set -eu

DEFAULT_DATABASE_URL="file:./prisma/database.sqlite"
DEFAULT_STORAGE_ROOT="uploads"

export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"
export STORAGE_ROOT="${STORAGE_ROOT:-$DEFAULT_STORAGE_ROOT}"

mkdir -p prisma uploads

echo "[entrypoint] running prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] starting next server"
exec npm run start
