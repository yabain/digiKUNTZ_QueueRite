# QueueRite — Scripts de déploiement & démarrage

Ce document est le **tableau de bord** de tous les scripts du projet. Deux familles :
les scripts d'**installation** (une seule fois, installent + configurent + démarrent) et
les scripts de **démarrage quotidien** (démarrent ce qui ne tourne pas encore, puis ouvrent
le navigateur en kiosk).

> **Raccourcis FAQ**
> - Installation complète (une fois) par environnement → voir [Tableau 1](#tableau-1--installation)
> - Démarrage quotidien → voir [Tableau 2](#tableau-2--démarrage-quotidien)
> - Workflow conseillé → voir [§ Workflow](#workflow-conseillé)

---

## Ports & prérequis communs

| Service | Port | Exposition réseau |
|---|---|---|
| MongoDB | 27017 | local (127.0.0.1) |
| Backend (NestJS) | 3000 | ✅ 0.0.0.0 (réseau) |
| Frontend | 4200 | ✅ 0.0.0.0 (réseau) |

- **Impression silencieuse** : l'URL du kiosk ouvre Chrome avec `--kiosk-printing` → imprimante
  **par défaut** utilisée sans boîte de dialogue. Le job part sur l'imprimante par défaut quel que
  soit le port (LPT1:, USB…). Il faut donc définir l'imprimante de tickets comme **par défaut**.
- **CORS** : réglé sur `*` (origines réseau autorisées ; l'app utilise un token bearer).
- **URL API auto-adaptée** : le frontend déduit `http://<hôte>:3000/api` de l'hôte qui le sert —
  aucune configuration par appareil.
- **Admin/back-office** : sur base neuve, appeler une fois `POST /api/auth/bootstrap`
  (`establishmentName`, `username`, `password` ≥ 12 caractères). La **borne POS** (accueil → choix
  POS → ticket) fonctionne sans login.

---

## Tableau 1 — Installation (une seule fois)

Ces scripts installent le runtime (Node/Mongo/Angular), les dépendances, construisent, configurent
la base (replica set `rs0`, user `queue_user`), puis **démarrent** back + front sur le réseau.

| Environnement | Installation complète (BACK + FRONT) | Backend seul | Frontend seul |
|---|---|---|---|
| **Windows 10/11** | `windows10-11Deployment.bat` | `Queue_App_Backend_v1.0\deploy-backend-win10-11.bat` | `Queue_App_Frontend_...\deploy-frontend-win10-11.bat` |
| **Windows 7** | `windows7Deployment.bat` | `Queue_App_Backend_v1.0\deploy-backend-win7.bat` | `Queue_App_Frontend_...\deploy-frontend-win7.bat` ⚠️ |
| **Linux** | `linuxKernelDeployment.sh` | `Queue_App_Backend_v1.0/deploy-backend-linux.sh` | `Queue_App_Frontend_.../deploy-frontend-linux.sh` |

> **`deploy-backend-*`** : génère le `.env` (si absent), `npm install`, `npm run build`, puis
> démarre MongoDB + backend — le tout sur le réseau.
> **`deploy-frontend-*`** : vérifie si **Angular CLI** est installé (sinon l'installe), installe les
> dépendances, puis lance le **moteur Angular** (`ng serve`, local + réseau). ⚠️ Sous **Windows 7**,
> Angular 17 exige Node ≥ 18 (non disponible) : le script ne peut donc pas le lancer → il exige un
> **`dist` pré-buildé** et fournit la marche à suivre.

---

## Tableau 2 — Démarrage quotidien

Démarrent MongoDB, le backend puis le frontend **en réseau**, attendent que les ports répondent,
et **ouvrent le navigateur en kiosk** (`--kiosk --kiosk-printing`).

| Environnement | Tout-en-un (BD + back + front + kiosk) | Backend seul | Frontend seul (+ Chrome kiosk) |
|---|---|---|---|
| **Windows 10/11** | `startQueueRiteWindows10-11.bat` | `Queue_App_Backend_v1.0\run-backend-win10-11.bat` | `Queue_App_Frontend_...\run-frontend-win10-11.bat` |
| **Windows 7** | `startQueueRiteWindows7.bat` | `Queue_App_Backend_v1.0\run-backend-win7.bat` | `Queue_App_Frontend_...\run-frontend-win7.bat` |
| **Linux** | `startQueueRiteLinux.sh` | `Queue_App_Backend_v1.0/run-backend-linux.sh` | `Queue_App_Frontend_.../run-frontend-linux.sh` |

> **`run-*`** = **démarrage SEUL** des services (sans installer de dépendance), sur l'IP locale :
> backend (MongoDB + NestJS sur le réseau) / frontend (**moteur Angular** `ng serve` local + réseau,
> puis Chrome kiosk — `dist` statique uniquement sous Win7). Exigent que l'installation
> (`deploy-*`) ait déjà été faite.

> **Windows 10/11** : le script `startQueueRiteWindows10-11.bat` couvre le démarrage complet
> (BD + backend + `ng serve` + Chrome kiosk). Les scripts modulaires restent utiles pour un
> démarrage séparé backend / frontend.

---

## Workflow conseillé

### Machine neuve — installation / déploiement (une fois, en admin/root)
```bash
# Backend (env + npm install + build + demarre)
Queue_App_Backend_v1.0/deploy-backend-<env>.{bat,sh}
# Frontend (verifie/installe Angular, npm install, compile, lance)
Queue_App_Frontend_Angular17_v1.0/deploy-frontend-<env>.{bat,sh}
```
*Ou, plus simple à la racine :* `windows10-11Deployment.bat` / `windows7Deployment.bat` /
`linuxKernelDeployment.sh` (installent les deux d'un coup).

### Démarrage quotidien (services uniquement, sans install)
```bash
# Backend (MongoDB + app reseau)
Queue_App_Backend_v1.0/run-backend-<env>.{bat,sh}
# Frontend (demarrage seul + Chrome kiosk)
Queue_App_Frontend_Angular17_v1.0/run-frontend-<env>.{bat,sh}
```
*Sur Win 10/11 :* `startQueueRiteWindows10-11.bat` — *sur Win7 :* `startQueueRiteWindows7.bat` —
*sur Linux :* `startQueueRiteLinux.sh` (tout d'un coup).

---

## Matériel POS réel (configuration cible)

| Élément | Valeur |
|---|---|
| Système | **Windows 10 64-bit** (migration depuis Windows 7 64-bit) |
| Imprimante tickets | **POS80** (papier **80 mm**), driver **64-bit** |
| Port | **LPT1:** (fourni par le driver ; compatible USB→port parallèle) |
| Impression | **Silencieuse** : kiosk lancé avec **`--kiosk-printing`** → job envoyé à l'imprimante **par défaut** |
| Format ticket | `@page size: 80mm auto` + CSS `@media print` (numéro gras, date/heure, nom de la file) |

**Points de vigilance après réinstallation du système (Win7 → Win10) :**
1. Réinstaller le **driver POS80 en 64 bits** compatible Windows 10.
2. Vérifier que la POS80 apparaît dans **Périphériques et imprimantes** avec le **port LPT1:**.
3. **Définir la POS80 comme imprimante par défaut** (indispensable pour `--kiosk-printing`).
4. Imprimer une **page test** Windows avant de valider l'application.
5. Basculer sur les scripts **`-win10-11`** (Node 20 + MongoDB 7 + `ng serve`) ; ne plus utiliser la
   famille `-win7` (inutilement restreinte). Windows 7 reste un cas particulier (Node 16, Mongo 4.4,
   frontend statique) pour les machines non migrées.

> L'application n'imprime pas directement sur le port : elle appelle `window.print()`, et Chrome
> (`--kiosk-printing`) envoie silencieusement le job à l'imprimante par défaut. Tant que la POS80 est
> la définie par défaut, l'impression passe par LPT1: sans aucune interaction utilisateur.

---

## Détail des dossiers

### Racine `Queue_Rite/`
| Script | Type | Rôle |
|---|---|---|
| `windows10-11Deployment.bat` | Installation | Install + config + démarrage (Win 10/11) |
| `windows7Deployment.bat` | Installation | Install + config + démarrage (Win 7, frontend statique) |
| `linuxKernelDeployment.sh` | Installation | Install + config + démarrage (Linux) |
| `startQueueRiteWindows10-11.bat` | Démarrage | BD + back + front (`ng serve`) + Chrome kiosk (Win 10/11) |
| `startQueueRiteWindows7.bat` | Démarrage | BD + back + front + Chrome kiosk (Win 7) |
| `startQueueRiteLinux.sh` | Démarrage | BD + back + front + Chrome/Chromium kiosk (Linux) |

### `Queue_App_Backend_v1.0/`
| Script | Rôle |
|---|---|
| `deploy-backend-win10-11.bat` | `.env` + install + build + démarre (Win 10/11) |
| `deploy-backend-win7.bat` | `.env` + install + build + démarre (Win 7, Mongo 4.4) |
| `deploy-backend-linux.sh` | `.env` + install + build + démarre (Linux) |
| `run-backend-win10-11.bat` | **Démarrage seul** MongoDB + backend réseau (Win 10/11) |
| `run-backend-win7.bat` | **Démarrage seul** MongoDB + backend réseau (Win 7) |
| `run-backend-linux.sh` | **Démarrage seul** MongoDB + backend réseau (Linux) |
| `startbackend.sh` | Démarrage rapide dev : MongoDB + backend (`node dist/main.js`) |

### `Queue_App_Frontend_Angular17_v1.0/`
| Script | Rôle |
|---|---|
| `deploy-frontend-win10-11.bat` | Vérifie/installe Angular CLI, `npm install`, lance `ng serve` + Chrome kiosk |
| `deploy-frontend-win7.bat` | Guide `dist` pré-buildé (Angular non disponible sur Win7) + lance + Chrome kiosk |
| `deploy-frontend-linux.sh` | Vérifie/installe Angular CLI, `npm install`, lance `ng serve` + Chrome kiosk |
| `run-frontend-win10-11.bat` | **Démarrage seul** `ng serve` (localhost + réseau) + Chrome kiosk, sans install |
| `run-frontend-win7.bat` | **Démarrage seul** `serve dist` (0.0.0.0) + Chrome kiosk, sans install |
| `run-frontend-linux.sh` | **Démarrage seul** moteur Angular `ng serve` (localhost + réseau) + Chrome/Chromium kiosk, sans install |

---

## Notes importantes

- **Licence/BCA** : MongoDB Community (SSPL) et Node.js sont installés via les dépôts officiels
  ou les binaires officiels selon l'environnement.
- **Windows 7** : mono compat Node 16 + MongoDB 4.4 ; **backend** (Nest 10) et **serviteur statique**
  frontend y tournent ; **pas de compilation Angular**.
- **Chrome** : requis pour le mode kiosk. Sous Linux, Chromium convient (`run-frontend-linux.sh` le
  détecte automatiquement) ; un `DISPLAY` graphique est nécessaire.
- **Sécurité** : ouvrir au réseau (3000/4200) uniquement sur la zone de confiance ; MongoDB reste en
  `127.0.0.1` par défaut.
- Les scripts qui démarrent des fenêtres `cmd /k` (backend / `ng serve`) restent ouverts pour le suivi
  des logs ; les fermer arrête le service correspondant.