# Queue App — Manuel d’installation et de déploiement (baseline V1)

Version 1.0 — 02 novembre 2026

## 1. Architecture cible

Une installation indépendante par établissement : serveur local Linux recommandé, MongoDB Community en replica set mono-nœud (`rs0`), backend NestJS et stockage média local. Les postes d’administration, de caisse et les écrans publics utilisent le navigateur sur le LAN. La borne utilise Ionic/Angular dans Electron sous Windows. Aucune opération métier ne doit dépendre d’Internet.

## 2. Prérequis serveur

- Linux 64 bits supporté par l’organisation (Ubuntu Server LTS recommandé pour le pilote).
- Node.js 20 LTS et npm compatibles avec la version verrouillée au moment de la release.
- MongoDB Community 7.x ou version qualifiée, configuré en replica set mono-nœud.
- Adresse IP fixe/réservation DHCP ; DNS local facultatif.
- Disque dédié aux données DB, médias et sauvegardes ; onduleur recommandé.
- Ports LAN à ouvrir uniquement sur le VLAN applicatif : API 3000 (ou reverse proxy HTTPS 443), MongoDB 27017 limité à localhost/serveur.

## 3. Installer MongoDB en replica set

1. Installer MongoDB Community depuis le dépôt officiel correspondant à la distribution.
2. Dans `mongod.conf`, activer `replication.replSetName: rs0`, définir `bindIp` sur loopback et l’interface serveur privée uniquement, et activer l’authentification avant toute mise en production.
3. Redémarrer MongoDB.
4. Initialiser une seule fois : `mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'`.
5. Vérifier `rs.status()` et attendre l’état PRIMARY.
6. Créer un utilisateur MongoDB dédié à Queue App avec droits sur la base `queue_app`; utiliser une URI authentifiée dans le `.env`.

> Le replica set mono-nœud active les transactions ; il ne fournit pas de haute disponibilité. Une panne du serveur reste une panne du service. Les sauvegardes et essais de restauration sont obligatoires.

## 4. Installer et démarrer le backend

```bash
cd backend
cp .env.example .env
# Éditer MONGODB_URI, PORT, CORS_ORIGINS, MEDIA_ROOT et SESSION_TTL_HOURS
npm ci   # ou npm install au premier déploiement si aucun lockfile n’est fourni
npm run build
npm run start:prod
```

Tester `http://127.0.0.1:3000/api/health`.

Créer l’administrateur initial avec des variables secrètes et jamais avec le mot de passe de démonstration :

```bash
MONGODB_URI='mongodb://USER:PASS@127.0.0.1:27017/queue_app?replicaSet=rs0&authSource=queue_app' ADMIN_USERNAME='admin' ADMIN_PASSWORD='CHANGE-THIS-TO-A-LONG-UNIQUE-SECRET' node scripts/seed-admin.js
```

Le compte seedé doit être protégé, et le secret conservé dans un coffre de secrets. L’API utilise le préfixe `/api`.

## 5. Installer le frontend Angular 17

```bash
cd frontend-angular
npm install
npm start
```

Ouvrir `http://localhost:4200`. Le frontend utilise par défaut `http://localhost:3000/api`. Pour modifier l’API sur un poste client, définir dans la console navigateur `localStorage.setItem('queue_api','http://IP_SERVEUR:3000/api')`, puis recharger. En production, servir le build derrière HTTPS/reverse proxy LAN et ne pas utiliser le serveur de développement Angular.

```bash
npm run build
```

## 6. Réseau et sécurité

- Réserver l’API aux sous-réseaux/VLAN autorisés ; ne pas exposer MongoDB aux postes clients.
- Mettre en place TLS sur le LAN via reverse proxy et certificats gérés par l’établissement.
- Configurer CORS avec les seules origines des frontends réellement déployés.
- Appliquer les mises à jour de sécurité OS/Node/MongoDB selon fenêtre de maintenance.
- Comptes Windows/Linux non privilégiés ; accès administration limité.
- Ne jamais utiliser le mot de passe de démonstration ; désactiver les comptes et terminaux non utilisés.
- Vérifier les permissions par API : masquer un bouton dans l’interface ne constitue pas une autorisation.

## 7. Entités et domaines présents dans le modèle

Establishment, User, Role, Permission, Session, Queue, QueueCounter, Ticket, TicketEvent, AgentAssignment, Device, Display, MediaAsset, Playlist, Announcement, AuditLog, License, PrintJob, BackupRecord, AppSetting, OperationalDay, IdempotencyRecord et OutboxEvent.

Les opérations principales de tickets sont : `POST /api/tickets` (Idempotency-Key obligatoire), `GET /api/tickets`, `GET /api/tickets/waiting/:queueId`, `POST /api/tickets/call-next`, puis `POST /api/tickets/:id/serve|complete|skip|recall`.

Les ressources administratives sont exposées par `GET|POST /api/resources/:entity` et `PATCH|DELETE /api/resources/:entity/:id`. La matrice de permissions complète doit être finalisée et testée avant production.

## 8. Exploitation, sauvegarde et restauration

La stratégie ADR exige une sauvegarde cohérente MongoDB + médias, chiffrée, avec manifeste, hashes, rétention quotidienne/mensuelle et tests de restauration. Le code livré ne fournit pas encore un orchestrateur de backup/restore de production : déployer une procédure opérée et vérifiée avant d’enregistrer des données réelles. Ne pas copier les fichiers de données MongoDB actifs à chaud. Exporter la base avec les outils MongoDB appropriés et prendre une copie coordonnée des médias lorsque les écritures sont suspendues.

## 9. Contrôles de réception pilote

- Installation et redémarrage après coupure électrique.
- 100 demandes simultanées sur une file : numéros uniques et aucun ticket perdu.
- Répéter une même clé d’idempotence : un seul ticket ; même clé avec payload différent : HTTP 409.
- Concurrence multi-caisses : un ticket attribué à une seule caisse ; ordre FIFO vérifié.
- Vérifier le changement de journée selon le fuseau et l’heure opérationnelle paramétrés.
- Déconnecter/reconnecter les clients ; comparer le snapshot avec la base.
- Vérifier les rôles par appels API directs, pas uniquement via l’UI.
- Tester média corrompu, stockage plein, DB indisponible et sauvegarde restaurée.
- Qualifier chaque modèle d’imprimante et papier sur le poste Windows réel.

## 10. Limites connues à fermer avant production

1. Sessions WebSocket : le gateway livré est une base d’intégration et ne remplace pas encore une validation cryptographique complète de session + autorisation par room.
2. Outbox : l’écriture transactionnelle est en place dans le flux ticket, mais le worker de publication et sa reprise doivent être activés et testés en continu.
3. Licence hors ligne signée Ed25519 : entité prévue, validation cryptographique/quotas à intégrer.
4. Médias : entités présentes ; upload sécurisé, validation réelle codec/hash, stockage disque et cache écran à compléter.
5. Backup/restore : entité et guide présents ; orchestrateur, chiffrement et test trimestriel à livrer.
6. Mise à jour signée : procédure de release et vérification de signature à intégrer.
7. Audio bilingue, ordonnancement multi-zones, statistiques détaillées et exports : finalisation nécessaire selon les critères PRD.
8. Impression silencieuse : adapter et certifier selon l’imprimante thermique et le driver choisis.
9. Tests automatisés : compléter tests unitaires, intégration, concurrence, sécurité et charge.

## 11. Démarrage local de démonstration

Pour une démonstration, lancer MongoDB avec replica set, backend, seed admin, puis Angular. Créer d’abord une file et une caisse depuis l’interface. Connecter la borne au compte terminal préparé par l’administrateur. Ne pas exposer la démonstration à Internet.
