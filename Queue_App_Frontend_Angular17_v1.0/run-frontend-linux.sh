#!/usr/bin/env bash
# =============================================================================
#  run-frontend-linux.sh  - Frontend QueueRite (Linux / macOS)
#  DEMARGE UNIQUEMENT le moteur Angular accessible depuis le reseau ET en
#  local : `ng serve --host 0.0.0.0 --port 4200`, SANS installer de
#  dependance. Ouvre ensuite Chrome/Chromium en Kiosk (impression silencieuse)
#  sur http://localhost:4200.
#
#  Prerequis : dependances installees (deploy-frontend-linux.sh) -> ng present.
#  Usage : bash run-frontend-linux.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=4200
URL="http://localhost:${PORT}"

GREEN='\e[1;32m'; YELLOW='\e[1;33m'; RED='\e[1;31m'; NC='\e[0m'
ok(){  printf "${GREEN}  [OK]${NC} %s\n" "$*"; }
warn(){ printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
die(){ printf "${RED}[ERREUR]${NC} %s\n" "$*"; exit 1; }

has_systemd(){ command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; }
is_up(){ (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }
is_macos(){ [ "$(uname -s)" = "Darwin" ]; }

# Chemin du binaire ng (local puis global)
find_ng() {
  [ -x "$ROOT/node_modules/.bin/ng" ] && { echo "$ROOT/node_modules/.bin/ng"; return 0; }
  command -v ng >/dev/null 2>&1 && { echo "ng"; return 0; }
  return 1
}

# ------------------------------------------------------------------
#  Detection de l'IP locale atteignable
# ------------------------------------------------------------------
lan_ips() {
  local ip h
  if is_macos; then
    for h in en0 en1 en2; do
      ip="$(ipconfig getifaddr "$h" 2>/dev/null)"
      [ -n "$ip" ] && echo "$ip"
    done
  else
    for ip in $(hostname -I 2>/dev/null); do [ -n "$ip" ] && echo "$ip"; done
  fi
}

# ------------------------------------------------------------------
#  Detection + lancement du navigateur (kiosk)
# ------------------------------------------------------------------
find_browser() {
  for c in google-chrome google-chrome-stable chromium chromium-browser chromium-browser-stable microsoft-edge-stable; do
    command -v "$c" >/dev/null 2>&1 && { echo "$c"; return 0; }
  done
  if is_macos; then
    local apps=(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    )
    local a
    for a in "${apps[@]}"; do [ -x "$a" ] && { echo "$a"; return 0; }; done
  fi
  return 1
}

launch_kiosk() {
  echo "[2/2] Ouverture du navigateur en Kiosk (impression silencieuse)..."
  local CHROME
  CHROME="$(find_browser)" || { die "Chrome/Chromium introuvable. Installez-le ou lancez ce script sur le POS."; }
  "$CHROME" --noerrdialogs --disable-pinch --kiosk --kiosk-printing "$URL" &
  ok "Kiosk ouvert sur $URL (pid $!)."
  if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ] && [ -z "${SSH_CONNECTION:-}" ] && ! is_macos; then
    warn "DISPLAY non defini : Chrome ne pourra pas afficher de fenetre."
  fi
}

firewall_note() {
  if is_macos && [ -x /usr/libexec/ApplicationFirewall/socketfilterfw ]; then
    local st
    st="$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | tr -d '\n')"
    case "$st" in
      *enabled*|*active*) warn "Pare-feu macOS ACTIVE : autorisez node/ng a recevoir des connexions (Reglages>Reseau>Pare-feu) ou desactivez-le brievement pour tester." ;;
    esac
  fi
}

# ------------------------------------------------------------------
#  MAIN
# ------------------------------------------------------------------
echo
echo "===== Run Frontend QueueRite - $(uname -s)  (moteur Angular) ====="
echo
cd "$ROOT" || die "dossier invalide"

NG="$(find_ng)" || die "Angular CLI introuvable. Lancez deploy-frontend-linux.sh pour installer les dependances."

echo "[1/2] Demarrage du moteur Angular sur 0.0.0.0:${PORT} (localhost + reseau)..."
if is_up "$PORT"; then
  ok "Frontend deja actif sur le port ${PORT}."
else
  if has_systemd && [ -f /etc/systemd/system/queue-frontend.service ]; then
    systemctl start queue-frontend >/dev/null 2>&1 && ok "Frontend demarre (systemd)." || warn "echec systemctl"
  else
    nohup "$NG" serve --host 0.0.0.0 --port "$PORT" > /tmp/queue-frontend.log 2>&1 &
    echo $! > /tmp/queue-frontend.pid
    ok "Moteur Angular lance (pid $(cat /tmp/queue-frontend.pid))."
  fi
fi

for i in $(seq 1 60); do is_up "$PORT" && { ok "port ${PORT} pret."; break; }; sleep 1; done

firewall_note
launch_kiosk

echo
echo "Frontend pret : ${URL}"
local_ip_count=0
while read -r ip; do
  [ -n "$ip" ] || continue
  local_ip_count=$((local_ip_count+1))
  ok "Acces reseau : http://${ip}:${PORT}"
done < <(lan_ips)
[ "$local_ip_count" -eq 0 ] && warn "IP locale non detectee automatiquement ; identifiez-la via ifconfig/ip addr."
echo
exit 0