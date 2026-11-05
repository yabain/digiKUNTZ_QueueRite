#!/usr/bin/env bash
# =============================================================================
#  startQueueRiteLinux.sh
#  Script de DEMARRAGE QUOTIDIEN de la borne Queue Rite (Linux).
#
#  Il demarre, dans l'ordre, uniquement ce qui ne tourne pas encore :
#   1. MongoDB               [base de donnees]
#   2. Backend (NestJS)      [port 3000, accessible reseau]
#   3. Frontend (SPA static) [port 4200, accessible reseau]
#   4. Attend que les ports 3000 et 4200 repondent
#   5. Ouvre Chrome/Chromium en Kiosk (`--kiosk --kiosk-printing`) sur
#      http://localhost:4200  => impression SILENCIEUSE sur l'imprimante
#      par defaut (POS58), sans boite de dialogue.
#
#  A executer :  sudo bash startQueueRiteLinux.sh
#    (sudo est requis pour gerer mongod/systemd ; option 2ci-dessous sinon)
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$SCRIPT_DIR/Queue_App_Backend_v1.0}"
FRONTEND_DIR="${FRONTEND_DIR:-$SCRIPT_DIR/Queue_App_Frontend_Angular17_v1.0}"
BACKEND_PORT=3000
FRONTEND_PORT=4200
URL="http://localhost:${FRONTEND_PORT}"

RED='\e[1;31m'; GREEN='\e[1;32m'; YELLOW='\e[1;33m'; CYAN='\e[1;36m'; NC='\e[0m'
ok(){   printf "${GREEN}  [OK]${NC} %s\n" "$*"; }
warn(){ printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
die(){  printf "${RED}[ERREUR]${NC} %s\n" "$*"; exit 1; }

# ------------------------------------------------------------------
#  Utilitaires
# ------------------------------------------------------------------
is_up() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

wait_port() {
  local p="$1" i
  for i in $(seq 1 30); do
    is_up "$p" && { ok "port $p pret."; return 0; }
    sleep 1
  done
  warn "port $p non pret apres 30s."
  return 1
}

has_systemd() { command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; }

# ------------------------------------------------------------------
#  1. MongoDB
# ------------------------------------------------------------------
start_mongod() {
  echo "[1/5] Demarrage de MongoDB..."
  if is_up 27017; then ok "MongoDB deja actif."; return 0; fi
  if has_systemd && systemctl is-active mongod >/dev/null 2>&1; then
    ok "MongoDB deja actif (systemd)."; return 0
  fi
  if has_systemd; then
    systemctl start mongod >/dev/null 2>&1 && ok "MongoDB demarre (systemd)." || warn "echec systemctl start mongod"
  elif command -v mongod >/dev/null 2>&1; then
    mongod --config /etc/mongod.conf --fork --pidfilepath /var/run/mongod.pid >/dev/null 2>&1 \
      && ok "MongoDB demarre (fork)." || warn "echec mongod --fork (un seul --fork par boot)."
  else
    warn "mongod absent ou deja en cours."
  fi
}

# ------------------------------------------------------------------
#  2. Backend
# ------------------------------------------------------------------
start_backend() {
  echo "[2/5] Demarrage du backend (port ${BACKEND_PORT}, reseau)..."
  [ -d "$BACKEND_DIR" ] || die "BACKEND_DIR invalide : $BACKEND_DIR"
  [ -f "$BACKEND_DIR/dist/main.js" ] || die "dist/main.js absent. A builder (linuxKernelDeployment.sh)."
  if is_up "$BACKEND_PORT"; then ok "Backend deja actif."; return 0; fi
  if has_systemd && [ -f /etc/systemd/system/queue-backend.service ]; then
    systemctl start queue-backend >/dev/null 2>&1 && ok "Backend demarre (systemd)." || warn "echec systemctl start queue-backend"
  else
    cd "$BACKEND_DIR"
    nohup node dist/main.js > /tmp/queue-backend.log 2>&1 &
    echo $! > /tmp/queue-backend.pid
    ok "Backend lance (pid $(cat /tmp/queue-backend.pid))."
  fi
}

# ------------------------------------------------------------------
#  3. Frontend
# ------------------------------------------------------------------
start_frontend() {
  echo "[3/5] Demarrage frontend : moteur Angular sur 0.0.0.0:${FRONTEND_PORT} (reseau + local)..."
  [ -d "$FRONTEND_DIR" ] || die "FRONTEND_DIR invalide : $FRONTEND_DIR"
  local NG=""
  if [ -x "$FRONTEND_DIR/node_modules/.bin/ng" ]; then NG="$FRONTEND_DIR/node_modules/.bin/ng"
  elif command -v ng >/dev/null 2>&1; then NG="ng"
  else die "Angular CLI introuvable. Lancez deploy-frontend-linux.sh."
  fi
  if is_up "$FRONTEND_PORT"; then ok "Frontend deja actif."; return 0; fi
  if has_systemd && [ -f /etc/systemd/system/queue-frontend.service ]; then
    systemctl start queue-frontend >/dev/null 2>&1 && ok "Frontend demarre (systemd)." || warn "echec systemctl start queue-frontend"
  else
    cd "$FRONTEND_DIR"
    nohup "$NG" serve --host 0.0.0.0 --port "$FRONTEND_PORT" > /tmp/queue-frontend.log 2>&1 &
    echo $! > /tmp/queue-frontend.pid
    ok "Moteur Angular lance (pid $(cat /tmp/queue-frontend.pid))."
  fi
}

# ------------------------------------------------------------------
#  4. Attente
# ------------------------------------------------------------------
wait_services() {
  echo "[4/5] Attente que les services repondent..."
  wait_port "$BACKEND_PORT"
  wait_port "$FRONTEND_PORT"
}

# ------------------------------------------------------------------
#  5. Chrome Kiosk
# ------------------------------------------------------------------
open_kiosk() {
  echo "[5/5] Ouverture du navigateur en Kiosk (impression silencieuse)..."
  local CHROME=""
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
  done
  [ -n "$CHROME" ] || die "Chrome/Chromium introuvable. Installez-le."

  # Une session graphique est necessaire pour ouvrir une fenetre.
  if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
    warn "DISPLAY non defini : Chrome ne pourra pas afficher de fenetre."
    warn "Lancez ce script depuis la session graphique du POS (locale, ssh -X, etc.)."
  fi

  # Kiosk + impression silencieuse (imprime sur l'imprimante par defaut).
  "$CHROME" --noerrdialogs --disable-pinch --kiosk --kiosk-printing "$URL" &
  CHROME_PID=$!
  ok "Kiosk ouvert sur $URL (pid $CHROME_PID)."
  echo "      Frappez Ctrl+Maj+Q ou Alt+F4 pour quitter la borne."
}

# ------------------------------------------------------------------
#  MAIN
# ------------------------------------------------------------------
main() {
  echo
  echo "============================================================"
  echo " Queue Rite - Demarrage Linux"
  echo "============================================================"
  echo

  start_mongod
  start_backend
  start_frontend
  wait_services
  open_kiosk

  echo
  echo "============================================================"
  echo " Termine. Bronze ouverte sur $URL"
  echo " - Reseau : backend http://IP:${BACKEND_PORT}, frontend http://IP:${FRONTEND_PORT}"
  echo "============================================================"
  echo
}

main "$@"