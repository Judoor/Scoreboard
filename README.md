# 🎲 ScoreBoard

Application web de suivi de scores pour jeux de société. Interface mobile-first, dark theme, architecture modulaire pour ajouter facilement de nouveaux jeux.

## Jeux disponibles

| Jeu | Description |
|-----|-------------|
| 🎲 Farkle | Dés — saisie manuelle, Main Chaude, pénalité 3 farkles |
| 🃏 Dutch | Cartes — élimination à 100 pts |
| 🎯 Yams | Dés — grille de combinaisons complète |
| 🎯 Fléchettes 301/501/701 | Dartboard SVG cliquable, Double In/Out, équipes |
| 🏹 Cricket | Dartboard SVG, variantes classique / Cut Throat / aléatoire, équipes |

## Lancer en local

### Prérequis

- [Docker](https://www.docker.com/get-started) + Docker Compose
- **OU** [Node.js](https://nodejs.org/) v18+

---

### Option A — Docker (recommandé)

```bash
# Cloner le repo
git clone https://github.com/TON_USERNAME/TON_REPO.git
cd TON_REPO

# Lancer
docker compose up --build

# Accéder à l'app
# http://localhost:8080
```

Pour arrêter :
```bash
docker compose down
```

Les données (joueurs, historique) sont persistées dans le dossier `data/` via un volume Docker.

---

### Option B — Node.js sans Docker

```bash
# Cloner le repo
git clone https://github.com/TON_USERNAME/TON_REPO.git
cd TON_REPO

# Installer les dépendances
npm install

# Lancer le serveur
npm start

# Accéder à l'app
# http://localhost:3000
```

---

## Structure du projet

```
scoreboard/
├── server.js              # Serveur Express (API + fichiers statiques)
├── package.json
├── Dockerfile
├── docker-compose.yml
├── data/                  # Base de données JSON (persistée)
│   └── db.json
└── public/                # Frontend
    ├── index.html
    ├── css/
    │   └── main.css
    └── js/
        ├── registry.js        # Liste des jeux
        ├── core/
        │   ├── app.js         # Logique principale
        │   └── utils.js       # Utilitaires partagés
        └── games/
            ├── dartboard.js   # Dartboard SVG partagée
            ├── farkle.js
            ├── dutch.js
            ├── yams.js
            ├── darts301.js
            └── dartscricket.js
```

## Ajouter un nouveau jeu

Voir [`AJOUTER_UN_JEU.md`](./AJOUTER_UN_JEU.md) pour le guide complet.

En résumé :
1. Créer `public/js/games/mon-jeu.js` avec les fonctions `createSession` et `renderSession`
2. Ajouter une entrée dans `public/js/registry.js`
3. C'est tout — le jeu apparaît automatiquement dans l'interface

## Déploiement

L'application tourne dans un seul conteneur Docker exposant le port `8080`. Elle est conçue pour être placée derrière un reverse proxy (Nginx, Caddy, Traefik...) qui gère le HTTPS.

Exemple avec TrueNAS Scale / Portainer : utiliser le `docker-compose.yml` tel quel, mapper le volume `./data` pour la persistance.
