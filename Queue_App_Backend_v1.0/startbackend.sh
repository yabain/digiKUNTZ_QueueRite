#!/usr/bin/env bash
# startbackend.sh — Start MongoDB then start the Queue App backend.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Starting MongoDB..."
if ! pgrep -x mongod >/dev/null; then
  mongod --dbpath "$HOME/mongodb/data/db" --bind_ip 127.0.0.1 --port 27017
  sleep 3
fi
mongosh --quiet --eval 'db.runCommand({ping:1})' && echo "    OK" || { echo "    FAILED"; exit 1; }

echo "==> Starting backend..."
npm run start:prod &
wait
