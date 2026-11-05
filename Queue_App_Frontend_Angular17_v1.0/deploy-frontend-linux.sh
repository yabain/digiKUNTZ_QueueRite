#!/usr/bin/env bash
# =============================================================================
#  deploy-frontend-linux.sh  - Frontend QueueRite (Linux)
#  DEPLOIE le frontend puis le lance (moteur Angular accessible en local
#  et sur le reseau, 0.0.0.0:4200).
#  1. Verifie si Angular CLI est installe :
#       - sinon  -> npm install -g @angular/cli (installation)
#  2. Installe les dependances du projet (npm install).
#  3. Demarre le moteur Angular (run-frontend-linux.sh -> ng serve)
#     puis ouvre le navigateur en Kiosk.
#
#  Usage : sudo bash deploy-frontend-linux.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\e[1;32m'; YELLOW='\e[1;33m'; RED='\e[1;31m'; NC='\e[0m'
ok(){ printf "${GREEN}  [OK]${NC} %s\n" "$*"; }
die(){ printf "${RED}[ERREUR]${NC} %s\n" "$*"; exit 1; }

echo
echo "===== Deploy Frontend QueueRite - Linux ====="
echo
cd "$ROOT" || die "dossier invalide"

# -------- 1. Verifier / installer Angular CLI --------
echo "[1/3] Verification d'Angular CLI..."
if [ -x node_modules/.bin/ng ] || command -v ng >/dev/null 2>&1; then
  ok "Angular CLI present."
else
  echo "  Angular CLI introuvable -> installation globale..."
  npm install -g @angular/cli@^17 >/tmp/deploy-frontend.log 2>&1 || die "echec npm install -g @angular/cli"
  ok "Angular CLI installe."
fi

# -------- 2. Dependances du projet --------
echo "[2/3] Installation des dependances du projet..."
npm install >/tmp/deploy-frontend.log 2>&1 || die "npm install"

# -------- 3. Demarrage (moteur Angular, delegue) --------
echo "[3/3] Demarrage du frontend (ng serve)..."
bash "$ROOT/run-frontend-linux.sh"

echo
echo "============================================================"
echo "  Deploy termine. Frontend demarre."
echo "============================================================"
echo
exit 0