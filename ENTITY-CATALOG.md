# Catalogue des entités Queue App

Les schémas Mongoose et les contrats API constituent la source de vérité technique de ce baseline. Les collections sont scindées par domaine ; les noms ci-dessous reprennent le vocabulaire PRD/ADR.

| Domaine | Entité | Rôle |
|---|---|---|
| Organisation | Establishment | Paramètres, fuseau, journée opérationnelle et établissement local |
| Identité | User | Comptes, rôles, langue et statut |
| Identité | Role / Permission | Catalogue des rôles et permissions |
| Identité | Session | Jetons opaques hachés, expiration et révocation |
| Files | Queue | Service, code, préfixe, zone, activation |
| Files | QueueCounter | Compteur atomique par file et journée opérationnelle |
| Tickets | Ticket | Numéro, statut, timestamps, caisse et agent |
| Tickets | TicketEvent | Historique immuable des transitions |
| Exploitation | OperationalDay | Début/fin de journée métier |
| Caisse | Counter | Poste d’appel et files autorisées |
| Caisse | AgentAssignment | Affectation d’un agent à une caisse |
| Équipements | Device | Borne, écran, caisse ou serveur |
| Équipements | Display | Écran public, zone et files |
| Médias | MediaAsset | Métadonnées et empreinte du fichier |
| Médias | Playlist | Séquence média par écran |
| Communication | Announcement | Message bilingue programmé |
| Audit | AuditLog | Trace des opérations d’administration |
| Licence | License | Plan, fonctionnalités, limites et signature |
| Impression | PrintJob | État, tentatives et ticket concerné |
| Exploitation | BackupRecord | Historique des sauvegardes |
| Configuration | AppSetting | Paramètres par établissement |
| Fiabilité | IdempotencyRecord | Réponse liée à une clé de commande |
| Fiabilité | OutboxEvent | Événement transactionnel à publier |

## Index métier critiques
- Ticket unique : `(establishmentId, queueId, operationalDate, sequenceNumber)`.
- QueueCounter unique : `(establishmentId, queueId, operationalDate)`.
- Idempotence unique : `(establishmentId, key)`.
- FIFO : `(establishmentId, queueId, status, createdAt, _id)`.
