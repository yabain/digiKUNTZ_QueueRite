#!/usr/bin/env bash
# =============================================================================
#  linuxKernelDeployment.sh
#  Mise en route complete du projet Queue Rite sur un environnement Linux
#  (Debian/Ubuntu via apt, RHEL/CentOS/Fedora via yum/dnf).
#
#  Etapes :
#   1. Verifie les droits root
#   2. Installe Node.js 20 (+ CLI NestJS / Angular)
#   3. Installe + configure MongoDB 7.0 :
#        * replica set "rs0"
#        * utilisateur queue_user / queue_secure_pass_2026 (db queue_app)
#        -> correspond au MONGODB_URI du backend (.env)
#   4. Demarre MongoDB (systemd), initialise rs0, cree l'utilisateur
#   5. Installe les dependances backend, build, demarre le backend (port 3000)
#   6. Installe les dependances frontend, demarre le frontend (0.0.0.0:4200)
#   7. Ouvre les ports 3000/4200 dans le pare-feu (ufw / firewalld / iptables)
#
#  A executer avec sudo :  sudo bash linuxKernelDeployment.sh
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$SCRIPT_DIR/Queue_App_Backend_v1.0}"
FRONTEND_DIR="${FRONTEND_DIR:-$SCRIPT_DIR/Queue_App_Frontend_Angular17_v1.0}"

# ---- Versions ----
NODE_VER="v20.18.0"
NODE_TAR="node-v20.18.0-linux-x64.tar.xz"
NODE_URL="https://nodejs.org/dist/${NODE_VER}/${NODE_TAR}"
NODE_INSTALL="/usr/local/lib/nodejs"

# MongoDB (derniere serie LTS)
MONGO_MAJOR="7.0"
# Floraison/resolve selon la distribution ci-dessous (apt)
MONGO_REPO_BASE="https://repo.mongodb.org/apt/ubuntu"
MONGO_ARCH="x86_64"

# ---- Identifiants DB (doivent matcher le .env) ----
MONGO_USER="queue_user"
MONGO_PASS="queue_secure_pass_2026"
MONGO_DB="queue_app"
MONGO_REPL="rs0"
MONGO_PORT=27017
BACKEND_PORT=3000
FRONTEND_PORT=4200

RED='\033[1;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; CYAN='\033[1;36m'; NC='\033[0m'
log()   { printf "${CYAN}[deploy]${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}[deploy]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()   { printf "${RED}[ERREUR]${NC} %s\n" "$*"; }
die()   { err "$*"; exit 1; }

# ---------------------------------------------------------------------
#  Detection de la distribution / gestionnaire de paquets
# ---------------------------------------------------------------------
detect_pkg() {
  if command -v apt-get >/dev/null 2>&1; then PKG=apt; DISTRO="$(. /etc/os-release && echo "$ID")"; CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")";
  elif command -v dnf >/dev/null 2>&1; then PKG=dnf;
  elif command -v yum >/dev/null 2>&1; then PKG=yum;
  else die "Gestionnaire de paquets non supporte (apt/dnf/yum)."
  fi
}

# ---------------------------------------------------------------------
#  1. Droits admin
# ---------------------------------------------------------------------
check_admin() {
  [ "$(id -u)" -eq 0 ] || die "A executer en root : sudo bash $0"
  ok "Droits root OK."
}

# ---------------------------------------------------------------------
#  2. Node.js (tarball officiel, independant de la distro)
# ---------------------------------------------------------------------
install_node() {
  if command -v node >/dev/null 2>&1; then
    ver="$(node -v 2>/dev/null | sed 's/^v//')"
    ok "Node.js deja installe : $ver"
    return 0
  fi
  need_download=true
  log "Installation de Node.js ${NODE_VER}..."
  mkdir -p "$NODE_INSTALL"
  cd /tmp
  [ -f "$NODE_TAR" ] || { command -v curl >/dev/null 2>&1 && curl -fsSL -o "$NODE_TAR" "$NODE_URL" || wget -q -O "$NODE_TAR" "$NODE_URL"; }
  [ -f "$NODE_TAR" ] || die "Echec du telechargement de Node.js"
  tar -xJf "$NODE_TAR" -C "$NODE_INSTALL" --strip-components=1
  ln -sf "$NODE_INSTALL/bin/node" /usr/bin/node
  ln -sf "$NODE_INSTALL/bin/npm"  /usr/bin/npm
  ln -sf "$NODE_INSTALL/bin/npx"  /usr/bin/npx
  ok "Node.js installe : $(node -v)  (npm $(npm -v))"
}

install_clis() {
  log "Installation CLI NestJS et Angular (global)..."
  npm install -g @nestjs/cli@^10 >/dev/null 2>&1 || warn "Echec installation CLI NestJS"
  npm install -g @angular/cli@^17  >/dev/null 2>&1 || warn "Echec installation CLI Angular"
  ln -sf "$NODE_INSTALL/bin/nest" /usr/bin/nest 2>/dev/null || true
  ln -sf "$NODE_INSTALL/bin/ng"   /usr/bin/ng   2>/dev/null || true
  ok "CLI NestJS / Angular installees."
}

# ---------------------------------------------------------------------
#  3. MongoDB via depot officiel
# ---------------------------------------------------------------------
install_mongo() {
  if command -v mongod >/dev/null 2>&1; then
    ok "MongoDB deja installe : $(mongod --version 2>/dev/null | head -1)"
    return 0
  fi
  log "Installation de MongoDB ${MONGO_MAJOR}..."
  case "$PKG" in
    apt)
      command -v wget >/dev/null 2>&1 || apt-get install -y wget gnupg ca-certificates >>/tmp/deploy.log 2>&1
      # Cle publique
      wget -qO - "https://www.mongodb.org/static/pgp/server-${MONGO_MAJOR}.asc" 2>/dev/null \
        | gpg --dearmor -o /usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg || die "Cle MongoDB introuvable"
      echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg ] ${MONGO_REPO_BASE} ${CODENAME}/mongodb-org/${MONGO_MAJOR} multiverse" \
        > /etc/apt/sources.list.d/mongodb-org-${MONGO_MAJOR}.list
      apt-get update >>/tmp/deploy.log 2>&1
      apt-get install -y mongodb-org >>/tmp/deploy.log 2>&1 || die "Echec apt install mongodb-org (codename ${CODENAME} non supporte ?)"
      ;;
    yum|dnf)
      cat > /etc/yum.repos.d/mongodb-org-${MONGO_MAJOR}.repo <<EOF
[mongodb-org-${MONGO_MAJOR}]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/${MONGO_MAJOR}/os/${MONGO_ARCH}
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-${MONGO_MAJOR}.asc
EOF
      ${PKG} install -y mongodb-org >>/tmp/deploy.log 2>&1 || die "Echec ${PKG} install mongodb-org"
      ;;
  esac
  ok "MongoDB installe."
}

configure_mongo() {
  local CONF="/etc/mongod.conf"
  [ -f "$CONF" ] && cp "$CONF" "${CONF}.orig" 2>/dev/null
  cat > "$CONF" <<EOF
# Configure par linuxKernelDeployment.sh
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: ${MONGO_PORT}
  bindIp: 0.0.0.0
replication:
  replSetName: ${MONGO_REPL}
EOF
  log "Configuration de MongoDB : replSet ${MONGO_REPL}, bind 0.0.0.0:${MONGO_PORT}"
}

# ---------------------------------------------------------------------
#  4. Demarrage MongoDB + init rs0 + utilisateur
# ---------------------------------------------------------------------
start_mongo() {
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl enable mongod >>/tmp/deploy.log 2>&1
    systemctl restart mongod >>/tmp/deploy.log 2>&1 || { err "echec systemctl restart mongod"; cat /var/log/mongodb/mongod.log 2>/dev/null | tail -20; exit 1; }
    log "MongoDB demarre (systemd)."
  else
    mongod --config /etc/mongod.conf --fork --pidfilepath /var/run/mongod.pid >>/tmp/deploy.log 2>&1
    log "MongoDB demarre (fork)."
  fi

  # Attendre que l'instance reponde
  for i in $(seq 1 30); do mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && break; sleep 2; done

  log "Initialisation de la replica set ${MONGO_REPL}..."
  mongosh --quiet --eval "rs.initiate({_id:'${MONGO_REPL}',members:[{_id:0,host:'127.0.0.1:${MONGO_PORT}'}]})" >/dev/null 2>&1 || true

  # Attendre PRIMARY
  for i in $(seq 1 30); do
    my="$(mongosh --quiet --eval 'db.runCommand({isMaster:1}).ismaster' 2>/dev/null | tr -d '[:space:]')"
    [ "$my" = "true" ] && break; sleep 2
  done

  log "Creation de l'utilisateur ${MONGO_USER}..."
  mongosh "mongodb://127.0.0.1:${MONGO_PORT}/${MONGO_DB}" --quiet --eval \
    "db.createUser({user:'${MONGO_USER}',pwd:'${MONGO_PASS}',roles:[{role:'dbOwner',db:'${MONGO_DB}'}]})" >/dev/null 2>&1 || true
  ok "MongoDB configure (replSet ${MONGO_REPL}, utilisateur ${MONGO_USER})."
}

# ---------------------------------------------------------------------
#  5. Backend : deps + build + (+ demarrage)
# ---------------------------------------------------------------------
deps_backend() {
  cd "$BACKEND_DIR" || die "BACKEND_DIR invalide : $BACKEND_DIR"
  [ -f package.json ] || die "package.json introuvable dans $BACKEND_DIR"
  [ -f .env ] || create_backend_env
  log "Installation des dependances backend..."
  npm install >>/tmp/deploy.log 2>&1 || die "npm install backend"
  log "Build backend..."
  npm run build >>/tmp/deploy.log 2>&1 || die "npm run build backend"
  ok "Backend compile."
}

create_backend_env() {
cat > "$BACKEND_DIR/.env" <<EOF
NODE_ENV=production
PORT=${BACKEND_PORT}
MONGODB_URI=mongodb://${MONGO_USER}:${MONGO_PASS}@127.0.0.1:${MONGO_PORT}/${MONGO_DB}?replicaSet=${MONGO_REPL}&authSource=${MONGO_DB}
CORS_ORIGINS=*
MEDIA_ROOT=./media
SESSION_TTL_HOURS=24
LOG_LEVEL=info
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
EOF
  log ".env backend genere (coherent avec la config MongoDB)."
}

start_backend_systemd() {
  cat > /etc/systemd/system/queue-backend.service <<EOF
[Unit]
Description=QueueRite Backend (NestJS)
After=network.target mongod.service

[Service]
WorkingDirectory=${BACKEND_DIR}
ExecStart=/usr/bin/node ${BACKEND_DIR}/dist/main.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable queue-backend >>/tmp/deploy.log 2>&1
  systemctl restart queue-backend >>/tmp/deploy.log 2>&1
  ok "Backend demarre (systemd) sur le port ${BACKEND_PORT} (reseau)."
}

start_backend_fallback() {
  cd "$BACKEND_DIR"
  nohup node dist/main.js > /tmp/queue-backend.log 2>&1 &
  echo $! > /tmp/queue-backend.pid
  ok "Backend demarre (nohup, pid $(cat /tmp/queue-backend.pid)) sur le port ${BACKEND_PORT}."
}

# ---------------------------------------------------------------------
#  6. Frontend : deps + moteur Angular (ng serve, local + reseau)
# ---------------------------------------------------------------------
deps_frontend() {
  cd "$FRONTEND_DIR" || die "FRONTEND_DIR invalide : $FRONTEND_DIR"
  [ -f package.json ] || die "package.json introuvable dans $FRONTEND_DIR"
  log "Installation des dependances frontend..."
  npm install >>/tmp/deploy.log 2>&1 || die "npm install frontend"
  ok "Frontend dependances installees."
}

start_frontend_systemd() {
  cat > /etc/systemd/system/queue-frontend.service <<EOF
[Unit]
Description=QueueRite Frontend (moteur Angular)
After=network.target

[Service]
WorkingDirectory=${FRONTEND_DIR}
ExecStart=${FRONTEND_DIR}/node_modules/.bin/ng serve --host 0.0.0.0 --port ${FRONTEND_PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable queue-frontend >>/tmp/deploy.log 2>&1
  systemctl restart queue-frontend >>/tmp/deploy.log 2>&1
  ok "Frontend demarre (systemd) sur 0.0.0.0:${FRONTEND_PORT} (reseau)."
}

start_frontend_fallback() {
  cd "$FRONTEND_DIR"
  nohup "$FRONTEND_DIR/node_modules/.bin/ng" serve --host 0.0.0.0 --port "${FRONTEND_PORT}" > /tmp/queue-frontend.log 2>&1 &
  echo $! > /tmp/queue-frontend.pid
  ok "Frontend demarre (nohup, pid $(cat /tmp/queue-frontend.pid)) sur 0.0.0.0:${FRONTEND_PORT}."
}

# ---------------------------------------------------------------------
#  7. Pare-feu
# ---------------------------------------------------------------------
open_firewall() {
  if command -v ufw >/dev/null 2>&1; then
    ufw allow ${BACKEND_PORT}/tcp >>/tmp/deploy.log 2>&1
    ufw allow ${FRONTEND_PORT}/tcp >>/tmp/deploy.log 2>&1
    ufw allow ${MONGO_PORT}/tcp >>/tmp/deploy.log 2>&1
    ok "Pare-feu ufw : ports ${BACKEND_PORT}/${FRONTEND_PORT}/${MONGO_PORT} ouverts."
    return
  fi
  if command -v firewall-cmd >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port=${BACKEND_PORT}/tcp >>/tmp/deploy.log 2>&1
    firewall-cmd --permanent --add-port=${FRONTEND_PORT}/tcp >>/tmp/deploy.log 2>&1
    firewall-cmd --reload >>/tmp/deploy.log 2>&1
    ok "Pare-feu firewalld : ports ${BACKEND_PORT}/${FRONTEND_PORT} ouverts."
    return
  fi
  if command -v iptables >/dev/null 2>&1; then
    iptables -I INPUT -p tcp --dport ${BACKEND_PORT}  -j ACCEPT >>/tmp/deploy.log 2>&1 || true
    iptables -I INPUT -p tcp --dport ${FRONTEND_PORT} -j ACCEPT >>/tmp/deploy.log 2>&1 || true
    ok "Pare-feu iptables : ports ${BACKEND_PORT}/${FRONTEND_PORT} ouverts (non persistants)."
    return
  fi
  warn "Aucun pare-feu reconnu (ufw/firewalld/iptables)."
}

# ---------------------------------------------------------------------
has_systemd() { command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; }

# ---------------------------------------------------------------------
#  MAIN
# ---------------------------------------------------------------------
main() {
  check_admin
  detect_pkg
  echo
  echo "============================================================"
  echo " Deploiement Queue Rite - Linux (${DISTRO:-?}/${CODENAME:-?})"
  echo " Backend : $BACKEND_DIR"
  echo " Frontend: $FRONTEND_DIR"
  echo " Mongo   : ${MONGO_MAJOR} (replSet ${MONGO_REPL})"
  echo "============================================================"
  echo

  install_node
  install_clis
  install_mongo
  configure_mongo
  start_mongo
  deps_backend
  if has_systemd; then start_backend_systemd; else start_backend_fallback; fi
  deps_frontend
  if has_systemd; then start_frontend_systemd; else start_frontend_fallback; fi
  open_firewall

  echo
  echo "============================================================"
  echo " DEPLOIEMENT TERMINE."
  echo " - Backend  : http://localhost:${BACKEND_PORT}  (reseau : http://IP:${BACKEND_PORT})"
  echo " - Frontend : http://localhost:${FRONTEND_PORT}  (reseau : http://IP:${FRONTEND_PORT})"
  echo " - Mongo    : replSet rs0, utilisateur ${MONGO_USER}"
  echo "============================================================"
  echo
}

main "$@"