<div align="center">

<img src="Queue_App_Frontend_Angular17_v1.0/src/assets/img/icons/logo_dk_queurite.png" alt="digiKUNTZ Queue Rite" width="140"/>

# digiKUNTZ — Queue Rite

**Système de gestion de files d'attente en temps réel**
Modern, réactif, déployable en local ou en réseau — pensé pour la borne, la caisse et les écrans d'affichage.

</div>

---

## ✨ Présentation

**Queue Rite** est une application complète qui gère les files d'attente : prise de ticket, appel du prochain client, rappel, mise en pause d'une caisse, écrans d'affichage et suivi. Elle fonctionne **sur un seul poste** (borne + caisse + backend local) **ou en réseau**, depuis un kiosk Chrome en plein écran avec **impression silencieuse** de tickets sur imprimante thermique (POS80 / POS58, port LPT1: ou USB).

> 🎯 **Simple à déployer** : des scripts prêts à l'emploi pour **Windows 10/11**, **Windows 7** et **Linux/macOS** installent et démarrent toute la pile (MongoDB → backend → frontend → kiosk).

---

## 🧩 Fonctionnalités

- 🎫 **Prise de ticket** (borne / POST) avec anti-doublon (clé d'idempotence).
- 📣 **Appel du prochain numéro**, **rappel** et **suivi** du statut (en attente / appelé / en service / terminé / sauté).
- ⏸️ **Mise en pause / reprise** d'une caisse, visible en direct sur l'écran d'affichage (couleur de pause).
- 🖥️ **Écrans d'affichage publics** (numéro courant, messages défilants, logo, médias).
- 🧾 **Impression silencieuse du ticket** : numéro en gras + date/heure + nom de la file — sans boîte de dialogue (Chrome `--kiosk-printing`).
- 🔐 **Authentification** des caissiers/administrateurs (token bearer), rôles et gardes.
- 🌐 **Accessible en réseau** : l'URL de l'API est auto-détectée (ou réglable dans les paramètres) ; CORS ouvert.
- 📊 **Tableau de bord** et statistiques.

---

## 🏗️ Architecture & stack

| Couche | Technologie | Dossier |
|---|---|---|
| **Frontend** | Angular 17 (standalone, SCSS) | `Queue_App_Frontend_Angular17_v1.0/` |
| **Backend** | NestJS 10, Mongoose 8 | `Queue_App_Backend_v1.0/` |
| **Base de données** | MongoDB (replica set `rs0`) | — |
| **Client desktop (alt.)** | Angular / Ionic / Electron | `Queue_App_Frontend_Ionic_Electron_Windows_v1.0/` |

```
┌────────────┐   HTTP/JSON (Bearer)   ┌──────────────┐   Mongoose   ┌─────────┐
│  Frontend  │ ──────────────────────► │   Backend    │ ────────────► │ MongoDB  │
│ (Angular)  │ ◄────────────────────── │  (NestJS)    │ ◄──────────── │  rs0     │
└────────────┘    CORS * / API auto    └──────────────┘   réplique     └─────────┘
        │  ← window.print() → kiosk Chrome --kiosk-printing → imprimante (POS80/LPT1)
```

**Ports** : backend `3000` · frontend `4200` · MongoDB `27017` (local).

---

## 📁 Structure du projet

```
digiKUNTZ_QueueRite/
├── Queue_App_Backend_v1.0/                 # API NestJS (port 3000)
│   ├── src/modules/{auth,counters,dashboard,file,tickets,realtime,health,...}
│   ├── scripts/ …                          # scripts util.
│   ├── deploy-backend-{win10-11,win7,linux}.# install + build + demarre
│   └── run-backend-{win10-11,win7,linux}.*  # demarrage seul (Mongo + app)
├── Queue_App_Frontend_Angular17_v1.0/      # SPA Angular 17 (port 4200)
│   ├── src/app/{cashier,file-pos,file-display,home-page,...}
│   ├── deploy-frontend-*.*                  # fixer Angular + install + lance
│   └── run-frontend-*.*                     # demarrage seul (ng serve) + kiosk
├── Queue_App_Frontend_Ionic_Electron_Windows_v1.0/   # variante desktop
├── *.bat / *.sh                             # scripts d'installation et de démarrage
└── README-DEPLOIEMENT.md                    # tableau de bord des scripts
```

---

## 🧰 Prérequis

| Élément | Recommandation |
|---|---|
| **Node.js** | **20 LTS** (≥ 20.9) — compatible Angular 17. *(Win7 : Node 16)* |
| **MongoDB** | **7.0** sur Win10/11/Linux ; **4.4** sur Win7. Replica set `rs0`. |
| **Angular CLI** | `@angular/cli@^17` |
| **Navigateur kiosk** | Google Chrome (impression silencieuse : `--kiosk-printing`) |

Les scripts d'installation gèrent automatiquement ces prérequis (téléchargent et installent).

---

## 🚀 Démarrage rapide

### 1) Installation (une seule fois) — choisir son environnement

| Environnement | Tout-en-un (install + lance) | Backend | Frontend |
|---|---|---|---|
| **Windows 10/11** | `windows10-11Deployment.bat` | `deploy-backend-win10-11.bat` | `deploy-frontend-win10-11.bat` |
| **Windows 7** | `windows7Deployment.bat` | `deploy-backend-win7.bat` | `deploy-frontend-win7.bat` ⚠️ |
| **Linux / macOS** | `linuxKernelDeployment.sh` | `deploy-backend-linux.sh` | `deploy-frontend-linux.sh` |

```bash
# Exemple Linux / macOS
./Queue_App_Backend_v1.0/deploy-backend-linux.sh
./Queue_App_Frontend_Angular17_v1.0/deploy-frontend-linux.sh
```

> ⚠️ **Win7** : Angular 17 exige Node ≥ 18 (indisponible) → on sert un **`dist` pré-buildé**. Compilez sur une machine moderne puis copiez `dist/queue-web/browser`.

### 2) Démarrage quotidien (services uniquement)

| Environnement | Tout-en-un | Backend | Frontend (+ kiosk) |
|---|---|---|---|
| **Windows 10/11** | `startQueueRiteWindows10-11.bat` | `run-backend-win10-11.bat` | `run-frontend-win10-11.bat` |
| **Windows 7** | `startQueueRiteWindows7.bat` | `run-backend-win7.bat` | `run-frontend-win7.bat` |
| **Linux / macOS** | `startQueueRiteLinux.sh` | `run-backend-linux.sh` | `run-frontend-linux.sh` |

```bash
# Exemple Linux / macOS
./Queue_App_Backend_v1.0/run-backend-linux.sh
./Queue_App_Frontend_Angular17_v1.0/run-frontend-linux.sh   # démarre ng serve + Chrome kiosk
```

### 3) Utilisation

- Frontend local : **http://localhost:4200** — réseau : **http://IP:4200**
- Backend API : **http://localhost:3000/api** — réseau : **http://IP:3000/api**
- Depuis un autre poste, l'URL de l'API se règle dans **Paramètres** (modal page d'accueil) ; sinon le frontend la déduit de l'hôte.

---

## 🧾 Impression silencieuse des tickets (POS)

Le bouton **« Générer Ticket »** appelle `window.print()`. Le kiosk lance Chrome avec **`--kiosk-printing`** → impression **sans aucune validation** sur l'imprimante **par défaut** (POS80 sur **LPT1:** par exemple).

**Conditions :**
1. Driver d'imprimante (POS80/POS58) installé — **64-bit** sur Windows 10.
2. Imprimante définie **par défaut** dans Windows.
3. Chrome lancé via le script avec `--kiosk --kiosk-printing`.

**Mise en garde Win7 → Win10** : réinstallez le driver **64-bit** sur Win10 et repassez sur les scripts `-win10-11`. Voir `README-DEPLOIEMENT.md`.

---

## 🌐 Accès réseau & CORS

- Le backend écoute sur `0.0.0.0:3000` (accessible réseau).
- `CORS_ORIGINS` est réglé sur **`*`** (toutes origines acceptées ; compatibilité token bearer).
- Frontend : `ng serve --host 0.0.0.0 --port 4200` (localhost **et** IP).
- L'URL de l'API par défaut dérive de l'hôte qui sert la page ; un `queue_api` placé dans le `localStorage` la surcharge.

---

## 🔒 Sécurité & configuration

- **`.env` est exclu du dépôt** (secrets) — un modèle figure dans `Queue_App_Backend_v1.0/.env.example`.
- Les scripts `deploy-backend-*` génèrent un `.env` cohérent (`CORS_ORIGINS=*`) si absent.
- Compte admin : à créer au premier lancement via `POST /api/auth/bootstrap` (`establishmentName`, `username`, `password` ≥ 12 caractères).
- N'exposez pas le backend/MongoDB hors de votre zone de confiance.

---

## 📚 Documentation

| Doc | Contenu |
|---|---|
| [README-DEPLOIEMENT.md](README-DEPLOIEMENT.md) | Tableau de bord complet des scripts (install / démarrage) par environnement |
| `INSTALLATION-DEPLOYMENT.md` | Installation et déploiement détaillés |
| `WINDOWS-BUILD-DEPLOYMENT.md` | Build/déploiement Windows |
| `ENTITY-CATALOG.md` | Catalogue des entités (queue, compteur, ticket…) |

---

<div align="center">

**digiKUNTZ Queue Rite** — © 2026 · Fait avec ❤️ pour des files d'attente fluides.

</div>