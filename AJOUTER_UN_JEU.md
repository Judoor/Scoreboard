# 🎲 ScoreBoard — Guide pour ajouter un jeu

Ce document explique comment ajouter une nouvelle fiche de score au projet.
Aucune connaissance du reste du code n'est nécessaire.

---

## En résumé

Ajouter un jeu = **2 fichiers à toucher**, puis un rebuild Docker :

| Étape | Fichier | Action |
|---|---|---|
| 1 | `public/js/games/mon-jeu.js` | Créer le module du jeu |
| 2 | `public/js/registry.js` | Enregistrer le jeu dans la liste |
| 3 | — | `docker compose up --build` |

---

## Étape 1 — Créer le module du jeu

Crée le fichier `public/js/games/mon-jeu.js`.

Un module expose exactement **deux fonctions** : `createSession` et `renderSession`.

```js
window.GAME_MODULES = window.GAME_MODULES || {};

window.GAME_MODULES['mon-jeu'] = (() => {

  /**
   * createSession(config, players)
   * ─────────────────────────────
   * Appelée au démarrage de la partie.
   * Retourne l'objet "session" qui représente l'état complet de la partie.
   *
   * @param config   — la config du jeu telle que définie dans registry.js
   * @param players  — tableau des joueurs sélectionnés
   *                   Chaque joueur a : { id, name, avatar, color }
   */
  function createSession(config, players) {
    return {
      // Ces 4 champs sont obligatoires (utilisés pour l'historique)
      gameId:       config.id,
      gameName:     config.name,
      gameEmoji:    config.emoji,
      winCondition: config.winCondition,  // 'highest' ou 'lowest'

      // Tes données de partie — mets ce dont tu as besoin
      players: players.map(p => ({
        playerId:   p.id,
        name:       p.name,
        avatar:     p.avatar,
        color:      p.color,
        totalScore: 0,
        rounds:     [],   // exemple : historique des scores par manche
      })),
      round: 1,
    };
  }

  /**
   * renderSession(session, container, onEnd)
   * ─────────────────────────────────────────
   * Appelée pour afficher l'interface de jeu.
   * C'est ici que tu construis ton HTML et gères la logique.
   *
   * @param session    — l'objet retourné par createSession()
   * @param container  — l'élément HTML dans lequel afficher l'interface
   * @param onEnd      — fonction à appeler quand la partie est terminée
   */
  function renderSession(session, container, onEnd) {

    // 1. Construire l'interface
    container.innerHTML = `
      <div>
        <h2>Manche ${session.round}</h2>
        <!-- ton HTML ici -->
        <button id="btnEndGame">Terminer la partie</button>
      </div>
    `;

    // 2. Gérer les interactions
    container.querySelector('#btnEndGame').addEventListener('click', () => {

      // 3. Appeler onEnd() avec les résultats finaux
      //    C'est ce qui sauvegarde la partie dans l'historique
      onEnd({
        gameId:       session.gameId,
        gameName:     session.gameName,
        gameEmoji:    session.gameEmoji,
        winCondition: session.winCondition,

        // Un objet par joueur avec son score final
        players: session.players.map(p => ({
          playerId:   p.playerId,
          name:       p.name,
          finalScore: p.totalScore,
        })),

        rounds:   session.round,  // nombre de manches jouées
        duration: null,           // durée en secondes, ou null
      });
    });
  }

  return { createSession, renderSession };
})();
```

---

## Étape 2 — Enregistrer dans le registre

Ouvre `public/js/registry.js` et ajoute une entrée dans le tableau `GAME_REGISTRY` :

```js
{
  id:          'mon-jeu',              // Doit correspondre à la clé dans GAME_MODULES
  name:        'Mon Jeu',             // Nom affiché sur le site
  emoji:       '🎯',                  // Emoji affiché sur la tuile
  color:       '#a855f7',             // Couleur principale (hex)
  colorDark:   '#4a044e',             // Version sombre de la couleur (pour les dégradés)
  description: 'Type • Courte description',
  minPlayers:  2,                     // Minimum de joueurs requis
  maxPlayers:  6,                     // Maximum de joueurs autorisés
  winCondition: 'highest',            // 'highest' = plus de points gagne
                                      // 'lowest'  = moins de points gagne
  targetScore: null,                  // Score cible ou d'élimination (ou null)
  module:      'js/games/mon-jeu.js', // Chemin vers ton fichier (relatif à public/)
},
```

---

## Étape 3 — Rebuild

```bash
docker compose up --build
```

Ton jeu apparaît automatiquement sur la page d'accueil. La sélection des joueurs,
la sauvegarde dans l'historique et l'affichage du podium sont gérés automatiquement.

---

## Utilitaires disponibles

Ces fonctions globales sont disponibles dans tous les modules, inutile de les réimporter.

### `esc(string)`
Échappe les caractères HTML. **À utiliser systématiquement** quand tu insères du texte
venant de l'utilisateur (noms de joueurs, etc.) dans du HTML.
```js
container.innerHTML = `<div>${esc(player.name)}</div>`;
```

### `toast(message, type)`
Affiche une notification temporaire en bas de l'écran.
```js
toast('Score enregistré !', 'success');  // type: 'info' | 'success' | 'error'
```

### `openModal(id)` / `closeModal(id)`
Ouvre ou ferme une modale par son id HTML.
```js
openModal('maModale');
closeModal('maModale');
```

### `formatDate(isoString)`
Formate une date ISO en français lisible : `"12 jan. 2025 à 18h30"`.

### `formatDateShort(isoString)`
Format court : `"12 jan."`.

---

## Conseils pratiques

**Pour un jeu à manches** (UNO, Belote, Yams...) : le pattern Dutch est un bon
modèle de départ. Copie `dutch.js`, renomme-le et adapte la logique de score.

**Pour un jeu à dés interactifs** : le pattern Farkle montre comment gérer des dés
cliquables et une sélection de combinaisons. Copie `farkle.js` comme base.

**Pour un jeu très simple** (comptage de points libres manche par manche) :
tu n'as besoin que d'inputs numériques par joueur et d'un bouton "Manche suivante".

**winCondition** : ce champ est utilisé automatiquement pour classer les joueurs
sur le podium et calculer les statistiques. Assure-toi qu'il est correct.
- `'highest'` → Farkle, Yams, UNO (celui avec le plus de points perd... donc `'lowest'`)
- `'lowest'`  → Dutch, Belote (moins de points = mieux)

---

## Structure complète du projet

```
scoreboard/
├── server.js                    ← Serveur Node.js (ne pas modifier)
├── package.json
├── Dockerfile
├── docker-compose.yml
└── public/                      ← Tout le frontend
    ├── index.html               ← Interface principale (ne pas modifier)
    ├── css/
    │   └── main.css             ← Styles globaux
    └── js/
        ├── registry.js          ← ✏️  Enregistrer les jeux ici
        ├── core/
        │   ├── utils.js         ← Utilitaires partagés (esc, toast, etc.)
        │   └── app.js           ← Contrôleur principal (ne pas modifier)
        └── games/
            ├── farkle.js        ← Exemple : jeu à dés interactifs
            ├── dutch.js         ← Exemple : jeu à manches avec saisie de scores
            └── *.js             ← ✏️  Tes nouveaux jeux ici
```
