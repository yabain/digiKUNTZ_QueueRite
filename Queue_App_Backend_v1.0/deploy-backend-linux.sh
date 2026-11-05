#!/usr/bin/env bash
# =============================================================================
#  deploy-backend-linux.sh  - Backend QueueRite (Linux)
#  DEPLOIE le backend puis le lance (port 3000, reseau).
#   1. Genere le .env (si absent) coherent avec MongoDB.
#   2. Installe les dependances (npm install).
#   3. Compile (npm run build).
#   4. Demarre (run-backend-linux.sh).
#
#  Usage : sudo bash deploy-backend-linux.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000
GREEN='\e[1;32m'; YELLOW='\e[1;33m'; RED='\e[1;31m'; NC='\e[0m'
ok(){ printf "${GREEN}  [OK]${NC} %s\n" "$*"; }
die(){ printf "${RED}[ERREUR]${NC} %s\n" "$*"; exit 1; }

echo
echo "===== Deploy Backend QueueRite - Linux ====="
echo
cd "$ROOT"

echo "[1/4] Verification du .env..."
if [ ! -f .env ]; then
  cat > .env <<EOF
NODE_ENV=production
PORT=${PORT}
MONGODB_URI=mongodb://queue_user:queue_secure_pass_2026@127.0.0.1:27017/queue_app?replicaSet=rs0&authSource=queue_app
CORS_ORIGINS=*
MEDIA_ROOT=./media
SESSION_TTL_HOURS=24
LOG_LEVEL=info
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
EOF
  ok ".env genere (CORS_ORIGINS=*)."
else
  ok ".env present."
fi

echo "[2/4] Installation des dependances..."
npm install >/tmp/deploy-backend.log 2>&1 || die "npm install"

echo "[3/4] Compilation backend..."
npm run build >/tmp/deploy-backend.log 2>&1 || die "npm run build"

echo "[4/4] Demarrage du backend..."
bash "$ROOT/run-backend-linux.sh"

echo
echo "============================================================"
echo "  Deploy termine. Backend demarre."
echo "============================================================"
echo
exit 0