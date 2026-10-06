#!/bin/sh
set -eu

: "${RENDER_EXTERNAL_HOSTNAME:?Render hostname is required}"
: "${DATABASE_URL:?Preview PostgreSQL connection is required}"
: "${BETTER_AUTH_SECRET:?Authentication secret is required}"
: "${PREVIEW_ACCESS_USERNAME:?Preview username is required}"
: "${PREVIEW_ACCESS_PASSWORD:?Preview passcode is required}"

export APP_ORIGIN="https://${RENDER_EXTERNAL_HOSTNAME}"

node dist/server/migrate.js
NODE_ENV=development DEMO_MODE=true node dist/server/seed.js
exec node dist/server/index.js
