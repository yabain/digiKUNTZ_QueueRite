# Queue_Rite — Installation & Déploiement (Frontend)

## Prérequis (tous OS)
- Node.js ≥ 20 (LTS)
- npm (livré avec Node)
- Angular CLI (`npm install -g @angular/cli` ou utiliser `npx ng`)

Le projet est un SPA standalone Angular 17 (`standalone: true`, pas de modules classiques).

## 1. Dépendances
```bash
npm install
```
Dépendances principales : `@angular/core ^17.3.12`, `rxjs ~7.8.1`.

## 2. Variables d'environnement / config API
Le frontend n'utilise pas de `.env` natif Angular. L'adresse du backend est configurée via `localStorage` (`queue_api`) ou par défaut :
```
http://localhost:3000/api
```
Pour changer le backend en production, le composant POS (`/file/:id/pos`) et le composant login ouvrent un modal permettant d'éditer `localStorage.setItem('queue_api', ...)`.

## 3. Variables d'environnement (si utilisation de proxy Angular CLI)
Dans `angular.json`, pas de proxy par défaut. Pour pointer le backend en développement :
```bash
ng serve --proxy-config proxy.conf.json
```
Exemple `proxy.conf.json` :
```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  },
  "/public": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

## 4. Build et démarrage
Développement :
```bash
npm run start       # ng serve --host 0.0.0.0
```
Production (statique) :
```bash
npm run build       # sortie dans dist/ — SPA statique
npm run build:admin # production (--configuration production)
```
Le build génère `dist/` avec `index.html` ; le serveur web (nginx, apache, etc.) doit servir le répertoire et rediriger toutes les routes sur `index.html` (SPA routing).

## 5. Déploiement statique (ex. nginx)
```nginx
server {
    listen 80;
    root /var/www/queue-app-web;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```
Copiez le contenu de `dist/` après `npm run build`.

## 6. Remarques d'architecture
- Tous les composants sont `standalone` : pas de `NgModule` nécessaire côté frontend.
- Routes protégées (`/queues`, `/counters`, `/users`, `/tickets`, etc.) utilisent `adminGuard` (`src/app/admin.guard.ts`) qui redirige vers `/` si non connecté ou non admin.
- `app.component` applique `showNav` (exclut `/login`, `/caisse`, POS) et `fullBleed`/`no-scroll` (`/login`, `/caisse`, POS) via le router (`Router` injecté).
- Les médias sont servies par le backend (`/public/file/:id`) et le logo est récupéré via `logoUrl` (streaming `res.pipe()` côté backend).
- Le composant `/` (`home-page`) propose un bouton ⚙ `openSettings()` qui ouvre un modal `showSettings` permettant d'éditer `localStorage.getItem('queue_api')` (nom d'attribut : `queue_api`).
