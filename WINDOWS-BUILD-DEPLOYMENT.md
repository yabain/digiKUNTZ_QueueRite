# Queue App Kiosk — Compilation et déploiement Windows (Ionic + Angular + Electron)

Version 1.0 — 02 novembre 2026

## 1. Objectif

Ce guide explique comment compiler l’application Ionic/Angular 17 puis l’empaqueter avec Electron en installateur Windows `.exe` (NSIS). La borne se connecte au backend local sur le LAN. Le ticket doit être créé et confirmé par le serveur avant impression.

## 2. Poste de compilation

- Windows 10/11 64 bits pour produire le paquet Windows (recommandé pour le pilote).
- Node.js 20 LTS, npm et Git.
- Visual C++ Build Tools si une dépendance native l’exige.
- Espace disque disponible pour `node_modules` et le dossier `release`.
- Accès au dépôt de dépendances au moment de l’installation npm. Après installation et cache, la compilation peut être réalisée dans un environnement isolé si toutes les dépendances sont disponibles.

## 3. Préparer la configuration de la borne

La version livrée lit les paramètres `queue_api`, `queue_token`, `kiosk_user` et `kiosk_password` depuis `localStorage`. Pour le déploiement réel, préparer un mécanisme d’enrôlement de terminal et de stockage protégé des secrets avant mise en production ; ne pas intégrer un mot de passe partagé dans le code source ou dans l’installeur.

Configurer l’API du serveur local, par exemple `http://192.168.10.10:3000/api`. En production, préférer HTTPS avec certificat approuvé par le poste.

## 4. Installer les dépendances et lancer en mode navigateur

```powershell
cd frontend-ionic-electron
npm install
npm run start
```

Ouvrir l’URL affichée par Ionic CLI. Vérifier que les files sont chargées, que le bouton de création génère un ticket unique et que les erreurs réseau sont présentées proprement.

## 5. Compiler le bundle web Ionic/Angular

```powershell
npm run build
```

Le résultat de production est généré dans `www/`. Electron charge `www/index.html` depuis le disque local. Vérifier que `base href="./"` est conservé afin que les ressources chargent correctement depuis `file://`.

## 6. Tester Electron avant packaging

```powershell
npm run electron:dev
```

Contrôler :
- fenêtre kiosk affichée ;
- `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true` ;
- aucune API Node exposée au renderer ;
- l’impression passe exclusivement par le preload et le canal IPC `queue:print-ticket` ;
- la création serveur précède l’impression ;
- une erreur d’imprimante ne déclenche pas la création d’un deuxième ticket.

## 7. Générer l’installateur Windows

Depuis Windows :

```powershell
npm run electron:build:win
```

Le paquet NSIS est produit dans `release/`, par exemple `Queue-App-Kiosk-1.0.0-Setup.exe`. L’installeur permet de choisir le répertoire et crée un raccourci bureau. Conserver le fichier de version exact et son SHA-256 dans le manifeste de livraison.

## 8. Installer sur la borne

1. Copier l’installateur depuis le serveur de déploiement ou une clé USB contrôlée.
2. Vérifier son hash SHA-256 par rapport au manifeste de livraison signé.
3. Installer avec un compte administrateur, puis exécuter la borne avec un compte Windows standard dédié.
4. Définir l’API LAN et procéder à l’enrôlement sécurisé du terminal.
5. Définir l’imprimante par défaut Windows, le format papier, les marges et le driver validé.
6. Désactiver la veille et configurer le lancement automatique selon la politique Windows de l’établissement.
7. Activer le mode kiosque après validation du parcours de sortie/maintenance.
8. Tester au moins 20 tickets, réimpressions, déconnexion réseau, papier épuisé et redémarrage.

## 9. Impression thermique

Le code de démonstration utilise `webContents.print({silent:true, printBackground:true})` et l’imprimante par défaut. Ce comportement dépend du pilote et de la configuration Windows. Il faut qualifier les modèles réellement utilisés, le papier 58/80 mm, les marges, la découpe, la vitesse et le rendu des caractères français/anglais. Pour un parc multi-imprimantes, remplacer la sélection implicite par une configuration administrée et une allowlist côté processus principal.

## 10. Signature et mise à jour

Avant distribution commerciale : signer le binaire Windows avec un certificat de signature de code, signer le manifeste de release, publier hashes et versions, contrôler la signature avant installation et définir une procédure de rollback. Les mises à jour automatiques via Internet ne sont pas requises ; une mise à jour depuis USB/LAN doit être possible et auditée.

## 11. Dépannage

- Écran blanc : vérifier `www/index.html`, base href relatif, console DevTools en build de diagnostic et chemin des assets.
- API inaccessible : vérifier IP/port, pare-feu, CORS, certificat TLS et VLAN.
- Authentification refusée : vérifier l’enrôlement et l’expiration de session ; ne pas stocker durablement le mot de passe en clair.
- Impression muette : vérifier imprimante par défaut, driver, spooler, papier, droits du compte Windows et journal IPC.
- Ticket dupliqué : ne jamais réessayer avec une nouvelle clé après timeout ambigu ; rechercher le résultat avec la clé d’idempotence et réimprimer le même ticketId.

## 12. Critères d’acceptation avant mise en service

- Build Angular/ionic réussi sur poste Windows propre.
- Installateur NSIS créé et vérifié par hash/signature.
- Installation/désinstallation testée.
- Application fonctionne sans accès Internet après installation.
- Connexion au serveur LAN et récupération des files.
- 100 demandes concurrentes côté backend sans numéros dupliqués.
- Impression silencieuse répétée sur modèle qualifié.
- Crash de la borne : ticket confirmé récupérable et réimprimable.
- IPC invalide/non autorisé rejeté.
