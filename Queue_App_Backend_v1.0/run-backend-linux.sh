#!/usr/bin/env bash
# =============================================================================
#  run-backend-linux.sh  - Backend QueueRite (Linux)
#  DEMARGE UNIQUEMENT les services : MongoDB + backend (port 3000, reseau),
#  SANS installer de dependance. Prerequis : deps deja installees
#  (deploy-backend-linux.sh) et dist/main.js present.
#
#  Usage : sudo bash run-backend-linux.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000
GREEN='\e[1;32m'; YELLOW='\e[1;33m'; RED='\e[1;31m'; NC='\e[0m'
ok(){ printf "${GREEN}  [OK]${NC} %s\n" "$*"; }
warn(){ printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
die(){ printf "${RED}[ERREUR]${NC} %s\n" "$*"; exit 1; }
has_systemd(){ command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; }
is_up(){ (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

echo
echo "===== Run Backend QueueRite - Linux  (demarrage seul) ====="
echo

echo "[1/3] MongoDB..."
if is_up 27017; then ok "MongoDB deja actif."
elif has_systemd; then systemctl start mongod >/dev/null 2>&1 && ok "MongoDB demarre (systemd)." || warn "echec systemctl start mongod"
elif command -v mongod >/dev/null 2>&1; then mongod --config /etc/mongod.conf --fork --pidfilepath /var/run/mongod.pid >/dev/null 2>&1 && ok "MongoDB demarre (fork)."
else warn "mongod absent."
fi

echo "[2/3] Backend sur le port ${PORT} (reseau)..."
[ -f "$ROOT/dist/main.js" ] || die "dist/main.js absent. Lancez deploy-backend-linux.sh."
if is_up "$PORT"; then ok "Backend deja actif."
else
  if has_systemd && [ -f /etc/systemd/system/queue-backend.service ]; then
    systemctl start queue-backend >/dev/null 2>&1 && ok "Backend demarre (systemd)." || warn "echec systemctl"
  else
    cd "$ROOT"
    nohup node dist/main.js > /tmp/queue-backend.log 2>&1 &
    echo $! > /tmp/queue-backend.pid
    ok "Backend lance (pid $(cat /tmp/queue-backend.pid))."
  fi
fi

echo "[3/3] Attente du port ${PORT}..."
for i in $(seq 1 30); do is_up "$PORT" && { ok "port ${PORT} pret."; break; }; sleep 1; done
echo
echo "Backend pret : http://localhost:${PORT}  (reseau : http://IP:${PORT})"
echo
exit 0