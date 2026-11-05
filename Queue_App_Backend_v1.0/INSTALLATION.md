# Queue_Rite — Installation & Déploiement (Backend)

## Prérequis (tous OS)
- Node.js ≥ 20 (LTS)
- MongoDB ≥ 8 (standalone ou replica set ; base `queue_app` recommandée)
- npm (livré avec Node)

## 1. Base de données
```bash
# Créer la base / utilisateur (ex. mongosh)
use queue_app
db.createUser({ user: "queue_user", pwd: "queue_secure_pass_2026", roles: [{ role: "readWrite", db: "queue_app" }] })
```
Le backend utilise `authSource=queue_app` dans l'URI.

## 2. Variables d'environnement (`.env` à la racine)
```env
MONGODB_URI=mongodb://queue_user:queue_secure_pass_2026@127.0.0.1:27017/queue_app?replicaSet=rs0&authSource=queue_app
```
> Ne pas mettre d'espaces ni de guillemets autour de `&` dans la chaîne (le `.`env d'origine contenait un `&` non protégé).

Pour la production, ajouter si nécessaire :
```env
NODE_ENV=production
PORT=3000
```

Le `.env` est ignoré par `.gitignore`. Créez-le manuellement.

## 3. Installation des dépendances
```bash
npm install
```
Packaging : `@nestjs/common ^10.4.15`, `mongoose ^8.9.5`, `@nestjs/schedule ^5.0.0`. Aucune dépendance supplémentaire requise.

## 4. Build
```bash
npm run build        # compile vers dist/
```

## 5. Démarrage
Développement (watch) :
```bash
npm run start:dev
```
Production (après `build`) :
```bash
npm run start:prod   # node dist/main.js
```
Le serveur écoute par défaut sur `0.0.0.0:3000`.

## 6. Vérifications post-démarrage
- `GET /health` (module Health) doit répondre.
- `GET /public/file/:id` doit retourner la file sans auth.
- Le cron horaire (`TicketCronService`, `@Cron`) tourne automatiquement via `@nestjs/schedule`.

## 7. Déploiement (Docker optionnel — non inclus ici)
Exemple minimal (si vous créez un `Dockerfile`) :
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["node", "dist/main.js"]
```
Exposer le port `3000` et monter `/app/.env` au déploiement.

## Remarques
- `MONGODB_URI` est lu par `ConfigModule.forRoot({ envFilePath: ['.env'] })` (`src/app.module.ts` ligne 17-18).
- Les mots de passe caisse sont hashés `bcrypt(10)` (`counters.service.ts`) ; jamais retournés (`sanitize()`).
- Le module `TicketsModule` expose `GET /tickets`, `POST /public/file/:id/tickets` (idempotence `Idempotency-Key`, throttle 120/min par IP).
