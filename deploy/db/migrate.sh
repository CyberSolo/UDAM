#!/bin/sh
set -e
echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  pg_isready -h postgres -U udam -d udam && break || sleep 2
done
for f in /migrations/*.sql; do
  echo "Applying $f"
  psql -h postgres -U udam -d udam -f "$f"
done
