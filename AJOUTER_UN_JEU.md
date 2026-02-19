# ScoreBoard — Guide de création d'un module de jeu

> **À une IA qui lit ce fichier :**
> Ce document contient **tout** ce dont tu as besoin pour créer un module de jeu complet, visuellement cohérent et fonctionnel. Lis-le **intégralement** avant d'écrire la moindre ligne de code. Il n'y a rien d'autre à lire — tout est ici : architecture, design system, patterns de code, exemples réels tirés du projet.
>
> **À un humain :**
> Même chose. Ce guide suffit. Tu n'as pas besoin de lire les autres fichiers.

---

## 0. Vue d'ensemble — ce que tu touches, ce que tu ne touches pas

Le framework ScoreBoard gère déjà tout ceci — **ne pas y toucher** :

- Système de comptes / connexion / sessions
- Sélection des joueurs et ordre de jeu
- Navigation entre les vues
- Sauvegarde dans l'historique
- Page de résultats / podium / confettis
- Reprise de partie après fermeture du navigateur
- Sidebar, topbar, responsive, dark mode

**Tu crées seulement deux choses :**

1. `public/js/games/mon-jeu.js` — logique et interface de la partie
2. Une entrée dans `public/js/registry.js` — déclarer le jeu

C'est tout. Après `docker compose up --build`, le jeu apparaît automatiquement dans la liste.

---

## 1. Direction artistique — lire avant de coder quoi que ce soit

### L'identité visuelle en une phrase

**Dark mode exclusif, typographie forte, couleurs vives utilisées avec parcimonie.**
Le site est sombre, dense, lisible. Jamais de fond blanc ou clair. Les couleurs servent à indiquer l'action ou l'appartenance à un joueur — pas à décorer.

---

### Les deux polices — règle absolue

| Police | Variable CSS | Quand l'utiliser |
|--------|-------------|-----------------|
| **Clash Display** | `var(--ff-display)` | Scores, grands chiffres, noms de joueurs, titres de section, boutons d'action |
| **Outfit** | `var(--ff-body)` | Labels, descriptions, hints, tout texte courant |

**Ne jamais mettre un score ou un chiffre important en Outfit.**
**Ne jamais mettre un texte explicatif en Clash Display.**

```css
/* ✅ Correct */
.mon-score { font-family: var(--ff-display); font-weight: 700; }
.mon-label { font-family: var(--ff-body); color: var(--text2); }

/* ❌ Interdit */
.mon-score { font-family: sans-serif; }
```

---

### Les tokens de couleur — jamais de valeur en dur

Utiliser **uniquement** ces variables CSS. Ne jamais écrire `#1a1a1a`, `rgba(0,0,0,.5)` ou `white` directement.

```css
/* ─── Fonds — du plus sombre au plus clair ─────────────── */
--bg:       #0d0d12   /* fond global de la page */
--bg2:      #12121a   /* fond alternatif léger */
--bg3:      #1a1a26   /* inputs, zones grisées, presets inactifs */
--surface:  #161622   /* cartes, panneaux, boîtes */
--surface2: #1e1e2e   /* éléments légèrement surélevés */

/* ─── Bordures ─────────────────────────────────────────── */
--border:   #252535   /* bordure standard */
--border2:  #30304a   /* bordure hover ou accentuée */

/* ─── Texte ─────────────────────────────────────────────── */
--text:     #e4e4f0   /* texte principal, lisible */
--text2:    #7878a0   /* texte secondaire, labels */
--text3:    #40404e   /* texte très discret, placeholders */

/* ─── Sémantique ─────────────────────────────────────────── */
--green:    #22c55e   /* succès, valider, score positif */
--red:      #f43f5e   /* erreur, supprimer, bust, pénalité */
--yellow:   #fbbf24   /* avertissement, attention */

/* ─── Mise en forme ──────────────────────────────────────── */
--r:        12px      /* border-radius cartes */
--rs:        8px      /* border-radius boutons */
--t:        .2s cubic-bezier(.4,0,.2,1)   /* transition standard */
```

---

### La couleur du jeu (`--gc`) et la couleur du joueur (`--pc`)

**`--gc` — couleur du jeu**
Définie dans le registre (`color:`), injectée automatiquement par le framework sur le conteneur de la session. Utilise-la pour les boutons d'action principaux, les bordures actives, les éléments de marque du jeu.

**`--pc` — couleur du joueur**
Chaque joueur a sa propre couleur (`p.color`). Injecte-la avec `style="--pc: ${p.color}"` sur l'élément conteneur du joueur, puis utilise `var(--pc)` dans le CSS.

```css
/* Fond teinté discret avec la couleur du jeu */
background: color-mix(in srgb, var(--gc) 12%, transparent);

/* Halo de focus pour le joueur actif */
box-shadow: 0 0 0 3px color-mix(in srgb, var(--pc) 20%, transparent);

/* Bordure active */
border-color: var(--pc);
```

---

### Palette de couleurs pour les jeux

Choisir une couleur principale vive et saturée. Voici les conventions du projet :

| Type de jeu | `color` | `colorDark` |
|-------------|---------|-------------|
| Dés / hasard | `#f97316` | `#7c2d06` |
| Cartes | `#0ea5e9` | `#0c4a6e` |
| Plateau / stratégie | `#22c55e` | `#14532d` |
| Fléchettes / précision | `#ef4444` | `#7f1d1d` |
| Combinaisons / réflexion | `#a855f7` | `#4a044e` |
| Mots / culture | `#ec4899` | `#831843` |
| Équipes / sport | `#14b8a6` | `#134e4a` |

`colorDark` = même teinte, luminosité ~10-15%. Utilisée pour les dégradés de fond.

---

### Anatomie visuelle d'une interface de jeu

Voici la structure type d'un écran de jeu. Respecter cet ordre vertical :

```
┌─────────────────────────────────────────────────────┐
│  [Bandeau message — info/warning/erreur]             │  ← apparaît/disparaît
├─────────────────────────────────────────────────────┤
│                                                     │
│  TABLEAU DES SCORES                                 │  ← cards joueurs
│  [Joueur 1] [Joueur 2] [Joueur 3] ...               │     en grille responsive
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ZONE DE CONTRÔLE                                   │  ← input + boutons
│  "Tour de [Nom]"                                    │
│  [Input ou interaction principale]                  │
│  [✔ Valider]  [↩ Annuler]                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Informations secondaires / historique du tour]    │  ← optionnel
└─────────────────────────────────────────────────────┘
```

---

### Composants CSS prêts à l'emploi

Copier ces blocs directement dans `main.css`. Remplacer le préfixe `mj-` par ton préfixe unique.

#### Carte joueur

```css
.mj-card {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: var(--r);
  padding: 14px 12px;
  transition: all var(--t);
}
.mj-card.active {
  border-color: var(--pc);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pc) 20%, transparent);
  transform: scale(1.02);
}
.mj-card.played { opacity: .45; filter: grayscale(.4); } /* joueur ayant déjà joué ce tour */
```

#### Score en grand

```css
.mj-big-score {
  font-family: var(--ff-display);
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--pc);
  text-align: center;
}
```

#### Barre de progression

```css
.mj-bar      { height: 4px; background: var(--bg3); border-radius: 2px; overflow: hidden; }
.mj-bar-fill { height: 100%; background: var(--pc); border-radius: 2px; transition: width .4s ease; }
```

#### Bouton principal (valider, action du tour)

```css
.mj-btn-main {
  flex: 1;
  padding: 13px 20px;
  background: var(--gc);
  color: #fff;
  border: none;
  border-radius: var(--rs);
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: .9rem;
  cursor: pointer;
  transition: all var(--t);
}
.mj-btn-main:hover:not(:disabled) { filter: brightness(1.1); }
.mj-btn-main:disabled             { opacity: .35; cursor: not-allowed; }
```

#### Bouton secondaire (annuler, options)

```css
.mj-btn-secondary {
  padding: 13px 16px;
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border2);
  border-radius: var(--rs);
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: .9rem;
  cursor: pointer;
  transition: all var(--t);
}
.mj-btn-secondary:hover:not(:disabled) { background: var(--bg3); }
.mj-btn-secondary:disabled             { opacity: .35; cursor: not-allowed; }
```

#### Preset / toggle (choix de configuration)

```css
.mj-preset {
  padding: 8px 18px;
  border-radius: 20px;
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--text2);
  font-family: var(--ff-body);
  font-size: .85rem;
  cursor: pointer;
  transition: all var(--t);
}
.mj-preset:hover,
.mj-preset.active { background: var(--gc); border-color: var(--gc); color: #fff; }
```

#### Input de score (grand, centré)

```css
.mj-input {
  width: 100%;
  background: var(--bg3);
  border: 2px solid var(--border);
  border-radius: var(--r);
  padding: 14px;
  color: var(--text);
  font-family: var(--ff-display);
  font-size: 1.8rem;
  font-weight: 700;
  text-align: center;
  outline: none;
  transition: border-color var(--t);
}
.mj-input:focus { border-color: var(--gc); }
.mj-input::placeholder {
  color: var(--text3);
  font-size: 1rem;
  font-family: var(--ff-body);
  font-weight: 400;
}
```

#### Bandeau message (info / warning / erreur / succès)

```css
.mj-msg {
  border-radius: var(--rs);
  padding: 0 14px;
  font-size: .85rem;
  font-weight: 600;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: all .3s ease;
}
.mj-msg.show     { max-height: 60px; opacity: 1; padding: 10px 14px; }
.mj-msg-info     { background: color-mix(in srgb, #0ea5e9 18%, transparent); color: #38bdf8; }
.mj-msg-warning  { background: color-mix(in srgb, var(--yellow) 18%, transparent); color: var(--yellow); }
.mj-msg-error    { background: color-mix(in srgb, var(--red) 18%, transparent); color: #fb7185; }
.mj-msg-success  { background: color-mix(in srgb, var(--green) 18%, transparent); color: var(--green); }
```

#### Label de section

```css
.mj-section-label {
  font-size: .72rem;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .05em;
  font-weight: 600;
}
```

#### Badge rond (numéro d'ordre, compteur, médaille)

```css
.mj-badge {
  background: var(--pc);
  color: #fff;
  border-radius: 50%;
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  font-size: .7rem;
  font-weight: 700;
  font-family: var(--ff-display);
  flex-shrink: 0;
}
```

---

### Règle de nommage CSS — obligatoire

**Chaque module préfixe TOUS ses sélecteurs** avec 2–4 lettres uniques.
Sans ça, les styles entrent en collision entre les modules du projet.

```css
/* ✅ Bien */
.mj-wrap { }
.mj-score-card { }
.mj-btn-validate { }

/* ❌ Interdit — collision possible */
.wrap { }
.card { }
.score { }
```

**Préfixes déjà pris dans ce projet :**
`fk-` Farkle · `dt-` Dutch · `ym-` Yams · `dt3-` Darts 301 · `dc-` Darts Cricket

Le CSS va toujours **à la fin de `public/css/main.css`** dans un bloc séparé :
```css
/* ── MON JEU ────────────────────────────────────────────────────────────── */
.mj-wrap { ... }
```

---

### Responsive — les règles de base

Le site est **mobile-first**. Quelques règles :

- Grille de joueurs : `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`
- Layouts côte-à-côte : utiliser `flex-wrap: wrap` + `min-width`, jamais de `width: 300px` fixe
- Breakpoint principal : `@media (max-width: 600px)` → passer en colonne
- Les scores importants : réduire la taille de police sur mobile (`font-size: 1.4rem` au lieu de `2.2rem`)

---

## 2. Architecture technique d'un module

### Les deux fonctions à exporter

```
public/js/games/mon-jeu.js
└── window.GAME_MODULES['mon-jeu']
    ├── createSession(config, players) → objet session
    └── renderSession(session, container, onEnd, onSave)
```

---

### `createSession(config, players)` — construire l'état initial

Appelée **une seule fois** au démarrage de la partie. Retourne un objet qui représente **tout l'état** de la partie.

**Règle absolue : la session doit être JSON-sérialisable.**
Pas de fonctions, pas de références DOM, pas de références circulaires.
Les callbacks `onEnd` et `onSave` sont réattachés automatiquement à chaque reprise — **ne pas les stocker dans la session**.

```js
function createSession(config, players) {
  return {
    // ── Champs OBLIGATOIRES — utilisés par le framework ──────────────────
    gameId:       config.id,
    gameName:     config.name,
    gameEmoji:    config.emoji,
    winCondition: config.winCondition,   // 'highest' | 'lowest'

    // ── Données joueurs ──────────────────────────────────────────────────
    players: players.map(p => ({
      playerId: p.id,      // ⚠️ OBLIGATOIRE — utilisé pour l'historique et les stats
      name:     p.name,
      avatar:   p.avatar,
      color:    p.color,
      // tes données propres :
      score:    0,
      history:  [],
    })),

    // ── État de la partie ────────────────────────────────────────────────
    currentIndex:  0,        // index du joueur dont c'est le tour
    round:         1,        // numéro de manche actuel
    phase:         'config', // 'config' | 'playing' | 'ended'
    previousState: null,     // pour la fonction Annuler

    // ── Options configurées par le joueur ────────────────────────────────
    // (rempli pendant la phase config)
    targetScore: null,
  };
}
```

---

### `renderSession(session, container, onEnd, onSave)` — le point d'entrée

**Signature exacte — ne jamais modifier l'ordre des paramètres.**

```js
function renderSession(session, container, onEnd, onSave) {
  // ⚠️ Toujours réattacher les callbacks en premier
  session.onEnd  = onEnd;
  session.onSave = onSave || (() => {});

  // Dispatcher selon la phase
  if (session.phase === 'config') renderConfig(session, container);
  else                            renderGame(session, container);
}
```

`container` est un `<div>` vide que tu remplis librement.
`onEnd` est la fonction à appeler quand la partie se termine.
`onSave` est la fonction à appeler après chaque modification d'état.

---

### `onSave` — règle des 3 secondes

Appelle `session.onSave()` **après chaque modification de l'état**, sans exception.
Si tu oublies, la reprise de partie sera incomplète ou perdue.

```js
// ✅ Correct
player.score += points;
session.currentIndex = nextIndex;
session.onSave();

// ❌ Le tour sera perdu si la page se ferme ici
player.score += points;
// (oubli de onSave)
```

---

### `onEnd` — structure obligatoire

```js
function endGame(session) {
  if (session.phase === 'ended') return; // ⚠️ Protection anti-double-appel obligatoire
  session.phase = 'ended';

  session.onEnd({
    // ── Identifiants du jeu ──────────────────────────────────────────────
    gameId:       session.gameId,
    gameName:     session.gameName,
    gameEmoji:    session.gameEmoji,
    winCondition: session.winCondition,

    // ── Résultats — un objet par joueur/équipe ───────────────────────────
    // ⚠️ playerId et finalScore sont OBLIGATOIRES
    // Le framework trie automatiquement selon winCondition
    players: session.players.map(p => ({
      playerId:   p.playerId,
      name:       p.name,
      finalScore: p.score,
    })),

    rounds:   session.round,  // entier ou null
    duration: null,           // durée en secondes ou null
  });
}
```

---

## 3. Squelette complet à copier-coller

Voici le template minimal complet. Remplace `mj` / `mon-jeu` par ton préfixe / identifiant.

```js
/**
 * MODULE [NOM DU JEU]
 * ─────────────────────────────────────────────────────────────────────────────
 * Description : [règles en 1-2 phrases]
 * winCondition : 'highest' (plus de points gagne) | 'lowest' (moins gagne)
 * Joueurs : [min]–[max]
 */
window.GAME_MODULES = window.GAME_MODULES || {};

window.GAME_MODULES['mon-jeu'] = (() => {

  // ─── SESSION ────────────────────────────────────────────────────────────
  function createSession(config, players) {
    return {
      gameId:       config.id,
      gameName:     config.name,
      gameEmoji:    config.emoji,
      winCondition: config.winCondition,
      players: players.map(p => ({
        playerId: p.id,
        name:     p.name,
        avatar:   p.avatar,
        color:    p.color,
        score:    0,
        history:  [],
      })),
      currentIndex:  0,
      round:         1,
      phase:         'config',
      previousState: null,
      targetScore:   null,
    };
  }

  // ─── RENDER PRINCIPAL ────────────────────────────────────────────────────
  function renderSession(session, container, onEnd, onSave) {
    session.onEnd  = onEnd;
    session.onSave = onSave || (() => {});
    if (session.phase === 'config') renderConfig(session, container);
    else                            renderGame(session, container);
  }

  // ─── PHASE CONFIG ────────────────────────────────────────────────────────
  // Supprimer cette fonction si le jeu n'a pas d'options de configuration.
  function renderConfig(session, container) {
    container.innerHTML = `
      <div class="mj-wrap">
        <div class="mj-config-box">
          <div class="mj-config-title">${session.gameEmoji} Configuration</div>

          <div class="mj-config-section">
            <div class="mj-section-label">Score à atteindre</div>
            <div class="mj-presets-row">
              <button class="mj-preset active" data-val="50">50</button>
              <button class="mj-preset"        data-val="100">100</button>
              <button class="mj-preset"        data-val="200">200</button>
            </div>
          </div>

          <button class="mj-btn-main" id="mjBtnStart">Lancer la partie →</button>
        </div>
      </div>`;

    let targetScore = 50;

    container.querySelectorAll('.mj-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mj-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        targetScore = parseInt(btn.dataset.val);
      });
    });

    container.querySelector('#mjBtnStart').addEventListener('click', () => {
      session.targetScore = targetScore;
      session.phase = 'playing';
      session.onSave();
      renderGame(session, container);
    });
  }

  // ─── PHASE JEU ───────────────────────────────────────────────────────────
  function renderGame(session, container) {
    container.innerHTML = `
      <div class="mj-wrap">
        <div class="mj-msg" id="mjMsg"></div>

        <div class="mj-scoreboard" id="mjScoreboard"></div>

        <div class="mj-controls">
          <div class="mj-turn-label" id="mjTurnLabel"></div>
          <input type="number" class="mj-input" id="mjInput"
            placeholder="Score du tour" inputmode="numeric" min="0"/>
          <div class="mj-btn-row">
            <button class="mj-btn-main"      id="mjBtnValidate">✔ Valider</button>
            <button class="mj-btn-secondary" id="mjBtnUndo" disabled>↩ Annuler</button>
          </div>
        </div>
      </div>`;

    const input = container.querySelector('#mjInput');

    container.querySelector('#mjBtnValidate').addEventListener('click',
      () => processAction(session, container));
    container.querySelector('#mjBtnUndo').addEventListener('click',
      () => undoAction(session, container));
    input.addEventListener('keydown',
      e => { if (e.key === 'Enter') processAction(session, container); });

    refreshUI(session, container);
    input.focus();
  }

  // refreshUI met à jour les parties dynamiques sans tout reconstruire.
  // Appeler après chaque changement d'état.
  function refreshUI(session, container) {
    renderScoreboard(session, container);
    renderTurnLabel(session, container);
  }

  function renderScoreboard(session, container) {
    const el = container.querySelector('#mjScoreboard');
    if (!el) return;
    const target = session.targetScore || 100;

    el.innerHTML = session.players.map((p, i) => {
      const isActive = i === session.currentIndex;
      const pct = Math.min(100, Math.round((p.score / target) * 100));

      return `
        <div class="mj-card ${isActive ? 'active' : ''}" style="--pc:${p.color}">
          <div class="mj-card-head">
            <span class="mj-card-avatar">${p.avatar}</span>
            <span class="mj-card-name">${esc(p.name)}</span>
            ${isActive ? '<span class="mj-turn-dot">●</span>' : ''}
          </div>
          <div class="mj-big-score">${p.score}</div>
          <div class="mj-bar">
            <div class="mj-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function renderTurnLabel(session, container) {
    const el = container.querySelector('#mjTurnLabel');
    if (!el) return;
    const p = session.players[session.currentIndex];
    el.innerHTML = `Tour de <strong style="color:${p.color}">${esc(p.name)}</strong>
      — Manche ${session.round}`;
  }

  // ─── LOGIQUE DE JEU ──────────────────────────────────────────────────────
  function processAction(session, container) {
    const input = container.querySelector('#mjInput');
    const value = parseInt(input.value);

    if (isNaN(value) || value < 0) {
      showMsg(container, 'Score invalide.', 'error');
      return;
    }
    input.value = '';

    saveState(session);  // ← avant la modification pour pouvoir annuler

    const player = session.players[session.currentIndex];
    player.score += value;
    player.history.push(value);

    container.querySelector('#mjBtnUndo').disabled = false;
    session.onSave();  // ← après chaque modification d'état

    // Vérifier la condition de victoire
    if (player.score >= (session.targetScore || 100)) {
      refreshUI(session, container);
      setTimeout(() => endGame(session), 300);
      return;
    }

    // Passer au joueur suivant
    session.currentIndex = (session.currentIndex + 1) % session.players.length;
    if (session.currentIndex === 0) session.round++;

    refreshUI(session, container);
    input.focus();
  }

  // ─── ANNULER ─────────────────────────────────────────────────────────────
  function saveState(session) {
    // JSON.parse/stringify = deep clone simple et fiable
    session.previousState = JSON.parse(JSON.stringify({
      players:      session.players,
      currentIndex: session.currentIndex,
      round:        session.round,
    }));
  }

  function undoAction(session, container) {
    if (!session.previousState) return;
    const prev = session.previousState;
    session.players      = prev.players;
    session.currentIndex = prev.currentIndex;
    session.round        = prev.round;
    session.previousState = null;
    container.querySelector('#mjBtnUndo').disabled = true;
    session.onSave();
    renderGame(session, container);  // reconstruire pour refléter l'état annulé
    showMsg(container, 'Tour annulé.', 'info');
  }

  // ─── FIN DE PARTIE ───────────────────────────────────────────────────────
  function endGame(session) {
    if (session.phase === 'ended') return;  // ⚠️ obligatoire
    session.phase = 'ended';

    session.onEnd({
      gameId:       session.gameId,
      gameName:     session.gameName,
      gameEmoji:    session.gameEmoji,
      winCondition: session.winCondition,
      players: session.players.map(p => ({
        playerId:   p.playerId,
        name:       p.name,
        finalScore: p.score,
      })),
      rounds:   session.round,
      duration: null,
    });
  }

  // ─── MESSAGE TEMPORAIRE ──────────────────────────────────────────────────
  let _msgTimer;
  function showMsg(container, text, type = 'info') {
    const el = container.querySelector('#mjMsg');
    if (!el) return;
    el.textContent = text;
    el.className = `mj-msg mj-msg-${type} show`;
    clearTimeout(_msgTimer);
    _msgTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ─── EXPORT ──────────────────────────────────────────────────────────────
  return { createSession, renderSession };

})();
```

**CSS à ajouter à la fin de `main.css` :**

```css
/* ── MON JEU ─────────────────────────────────────────────────────────────── */
.mj-wrap         { display:flex; flex-direction:column; gap:14px; padding-bottom:40px; }
.mj-config-box   { max-width:480px; margin:0 auto; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:28px; display:flex; flex-direction:column; gap:20px; }
.mj-config-title { font-family:var(--ff-display); font-size:1.2rem; font-weight:700; text-align:center; }
.mj-config-section { display:flex; flex-direction:column; gap:10px; }
.mj-section-label  { font-size:.72rem; color:var(--text3); text-transform:uppercase; letter-spacing:.05em; font-weight:600; }
.mj-presets-row    { display:flex; gap:8px; flex-wrap:wrap; }
.mj-preset       { padding:8px 18px; border-radius:20px; background:var(--bg3); border:1px solid var(--border); color:var(--text2); font-family:var(--ff-body); font-size:.85rem; cursor:pointer; transition:all var(--t); }
.mj-preset:hover, .mj-preset.active { background:var(--gc); border-color:var(--gc); color:#fff; }
.mj-scoreboard   { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
.mj-card         { background:var(--surface); border:2px solid var(--border); border-radius:var(--r); padding:14px 12px; transition:all var(--t); }
.mj-card.active  { border-color:var(--pc); box-shadow:0 0 0 3px color-mix(in srgb,var(--pc) 20%,transparent); transform:scale(1.02); }
.mj-card-head    { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.mj-card-avatar  { font-size:1.3rem; }
.mj-card-name    { font-size:.82rem; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mj-turn-dot     { color:var(--pc); font-size:.7rem; animation:mjPulse 1s infinite; }
.mj-big-score    { font-family:var(--ff-display); font-size:2rem; font-weight:700; letter-spacing:-.03em; text-align:center; color:var(--pc); margin-bottom:10px; }
.mj-bar          { height:4px; background:var(--bg3); border-radius:2px; overflow:hidden; }
.mj-bar-fill     { height:100%; background:var(--pc); border-radius:2px; transition:width .4s ease; }
.mj-controls     { background:var(--surface); border:1px solid var(--border); border-radius:var(--r); padding:20px; display:flex; flex-direction:column; gap:14px; }
.mj-turn-label   { font-size:.9rem; color:var(--text2); text-align:center; }
.mj-input        { width:100%; background:var(--bg3); border:2px solid var(--border); border-radius:var(--r); padding:14px; color:var(--text); font-family:var(--ff-display); font-size:1.8rem; font-weight:700; text-align:center; outline:none; transition:border-color var(--t); }
.mj-input:focus  { border-color:var(--gc); }
.mj-input::placeholder { color:var(--text3); font-size:1rem; font-family:var(--ff-body); font-weight:400; }
.mj-btn-row      { display:flex; gap:10px; }
.mj-btn-main     { flex:1; padding:13px; background:var(--gc); color:#fff; border:none; border-radius:var(--rs); font-family:var(--ff-display); font-weight:700; font-size:.9rem; cursor:pointer; transition:all var(--t); }
.mj-btn-main:hover:not(:disabled) { filter:brightness(1.1); }
.mj-btn-main:disabled { opacity:.35; cursor:not-allowed; }
.mj-btn-secondary { padding:13px 16px; background:var(--surface2); color:var(--text); border:1px solid var(--border2); border-radius:var(--rs); font-family:var(--ff-display); font-weight:700; font-size:.9rem; cursor:pointer; transition:all var(--t); }
.mj-btn-secondary:hover:not(:disabled) { background:var(--bg3); }
.mj-btn-secondary:disabled { opacity:.35; cursor:not-allowed; }
.mj-msg         { border-radius:var(--rs); padding:0 14px; font-size:.85rem; font-weight:600; max-height:0; overflow:hidden; opacity:0; transition:all .3s ease; }
.mj-msg.show    { max-height:60px; opacity:1; padding:10px 14px; }
.mj-msg-info    { background:color-mix(in srgb,#0ea5e9 18%,transparent); color:#38bdf8; }
.mj-msg-warning { background:color-mix(in srgb,var(--yellow) 18%,transparent); color:var(--yellow); }
.mj-msg-error   { background:color-mix(in srgb,var(--red) 18%,transparent); color:#fb7185; }
.mj-msg-success { background:color-mix(in srgb,var(--green) 18%,transparent); color:var(--green); }
@keyframes mjPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
@media (max-width:600px) {
  .mj-scoreboard { grid-template-columns:repeat(2,1fr); }
  .mj-big-score  { font-size:1.5rem; }
}
```

---

## 4. Enregistrer le jeu dans le registre

Ouvrir `public/js/registry.js`, ajouter dans le tableau `GAME_REGISTRY` :

```js
{
  id: 'mon-jeu',
  // ⚠️ Doit correspondre EXACTEMENT à la clé dans window.GAME_MODULES['...']

  name:  'Mon Jeu',
  emoji: '🎯',

  color:     '#a855f7',
  // Couleur principale du jeu — vive et saturée.
  // Devient var(--gc) dans la session. Voir tableau de couleurs section 1.

  colorDark: '#4a044e',
  // Même teinte, très assombrie (luminosité ~10-15%).

  description: 'Type • Description courte',
  // Convention : "Type de jeu • Ce qu'on fait en 5-7 mots max"
  // Exemples :  "Dés • Accumule des points sans dépasser"
  //             "Cartes • Le moins de points possible"
  //             "Plateau • Ferme tes cibles avant l'adversaire"

  minPlayers: 2,
  maxPlayers: 6,

  winCondition: 'highest',
  // 'highest' → plus de points = meilleur (Farkle, Yams, Belote)
  // 'lowest'  → moins de points = meilleur (Dutch, Fléchettes 301)

  targetScore: null,
  // null    → pas de score cible (Yams, Cricket)
  // nombre  → score à atteindre (Farkle: 10000) ou d'élimination (Dutch: 100)

  module: 'js/games/mon-jeu.js',
},
```

---

## 5. Fonctions utilitaires globales

Disponibles partout, sans import.

### `esc(str)` — obligatoire pour tout texte utilisateur

```js
// ✅ Toujours
container.innerHTML = `<div>${esc(player.name)}</div>`;
container.innerHTML = `<span>${esc(session.gameName)}</span>`;

// ❌ Jamais — faille XSS
container.innerHTML = `<div>${player.name}</div>`;
```

### `toast(message, type)` — notification globale 3 secondes

```js
toast('Partie sauvegardée !', 'success');
toast('Score invalide', 'error');
toast('Information', 'info');    // type par défaut
```

### `loadScript(src)` — charger un module JS à la demande

```js
// Utile si ton module dépend d'un autre fichier JS
if (!window.DartBoard) await loadScript('js/games/dartboard.js');
```

### `formatDateShort(isoString)`

```js
formatDateShort('2025-06-14T20:30:00Z')  // → "14 juin 20h30"
```

---

## 6. Patterns avancés

### Jeu avec phase de configuration

La phase config permet de choisir des options avant le début (score cible, mode de jeu, règles spéciales). La session commence avec `phase: 'config'`. Après validation, passer à `phase: 'playing'` et appeler `session.onSave()`.

Voir `farkle.js` pour un exemple simple, `darts301.js` pour un exemple avec choix de mode (solo/équipes).

---

### Jeu avec équipes

Les membres d'une équipe jouent à tour de rôle. L'équipe partage un score commun.

```js
// Dans createSession
const TEAM_COLORS = ['#f97316', '#0ea5e9', '#22c55e', '#a855f7'];
const teamSize    = 2;  // peut être configuré pendant la phase config
const nbTeams     = Math.floor(players.length / teamSize);

// Construction des équipes dans l'ordre de sélection des joueurs :
// joueurs 0,1 → équipe 1  |  joueurs 2,3 → équipe 2  |  etc.
teams: Array.from({ length: nbTeams }, (_, t) => ({
  id:            `team${t + 1}`,
  name:          `Équipe ${t + 1}`,
  color:         TEAM_COLORS[t],
  members:       players.slice(t * teamSize, (t + 1) * teamSize)
                        .map(p => ({ ...p, playerId: p.id })),
  currentMember: 0,   // index du membre qui joue dans cette équipe
  score:         0,
  history:       [],
})),

// Rotation interne à l'équipe
team.currentMember = (team.currentMember + 1) % team.members.length;

// Dans onEnd — les équipes jouent le rôle des joueurs
players: session.teams.map(t => ({
  playerId:   t.id,
  name:       t.name,
  finalScore: t.score,
})),
```

---

### Jeu avec grille de cases (type Yams, feuille de score)

```js
// Dans createSession
const CASES = ['aces', 'twos', 'threes', 'brelan', 'full', 'chance'];

players: players.map(p => ({
  playerId: p.id, name: p.name, avatar: p.avatar, color: p.color,
  cases: Object.fromEntries(CASES.map(id => [id, null])),
  //     null    = case non remplie
  //     number  = score saisi (peut être 0)
  //     'X'     = case barrée volontairement (vaut 0)
})),

// Vérifier si toutes les cases sont remplies
const isDone = p => CASES.every(id => p.cases[id] !== null);

// Calculer le total
const total = p => CASES.reduce((sum, id) =>
  sum + (typeof p.cases[id] === 'number' ? p.cases[id] : 0), 0);

// Compter les cases restantes
const remaining = p => CASES.filter(id => p.cases[id] === null).length;
```

---

### Jeu avec score décompte (type 301)

```js
// Dans createSession
players: players.map(p => ({
  playerId: p.id, name: p.name, avatar: p.avatar, color: p.color,
  score: session.startScore || 301,  // part du max, descend vers 0
})),

// Dans processAction
const newScore = player.score - points;

if (newScore < 0) {
  showMsg(container, '💥 Bust ! Score inchangé.', 'error');
  return;  // annuler sans modifier l'état
}

player.score = newScore;

if (newScore === 0) {
  session.onSave();
  endGame(session);
  return;
}
```

---

### Annuler sur plusieurs tours (pile d'états)

Par défaut, le template ne permet d'annuler qu'un seul tour. Pour permettre d'annuler plusieurs tours en arrière :

```js
// Dans createSession
undoStack: [],

// saveState empile (max 10 états conservés)
function saveState(session) {
  session.undoStack.push(JSON.parse(JSON.stringify({
    players:      session.players,
    currentIndex: session.currentIndex,
    round:        session.round,
  })));
  if (session.undoStack.length > 10) session.undoStack.shift();
}

// undoAction dépile
function undoAction(session, container) {
  if (!session.undoStack.length) return;
  const prev = session.undoStack.pop();
  Object.assign(session, prev);
  container.querySelector('#mjBtnUndo').disabled = session.undoStack.length === 0;
  session.onSave();
  renderGame(session, container);
}
```

---

### Afficher un popup de saisie

Pour saisir un score sur une case spécifique (comme dans Yams), utiliser un overlay flottant :

```js
function openPopup(session, container, onValidate) {
  const overlay = container.querySelector('#mjPopup');
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="mj-popup-box">
      <input type="number" class="mj-input" id="mjPopInput" inputmode="numeric"/>
      <div class="mj-btn-row">
        <button class="mj-btn-main"      id="mjPopOk">✔ Valider</button>
        <button class="mj-btn-secondary" id="mjPopCross">✕ Barrer</button>
        <button class="mj-btn-secondary" id="mjPopCancel">Annuler</button>
      </div>
    </div>`;

  setTimeout(() => overlay.querySelector('#mjPopInput').focus(), 30);

  overlay.querySelector('#mjPopOk').addEventListener('click', () => {
    const v = parseInt(overlay.querySelector('#mjPopInput').value);
    if (!isNaN(v) && v >= 0) { overlay.style.display = 'none'; onValidate(v); }
  });
  overlay.querySelector('#mjPopCross').addEventListener('click', () => {
    overlay.style.display = 'none'; onValidate('X');
  });
  overlay.querySelector('#mjPopCancel').addEventListener('click', () => {
    overlay.style.display = 'none';
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
}
```

---

## 7. Exemples de jeux existants — lesquels regarder

| Tu crées... | Regarde |
|-------------|---------|
| Score cumulatif, saisie libre, manches | `dutch.js` |
| Score cumulatif avec config + règles spéciales | `farkle.js` |
| Feuille de score, cases à remplir/barrer | `yams.js` |
| Score décompte vers 0, interface visuelle riche | `darts301.js` |
| Grille d'état par cible/zone, tours structurés | `dartscricket.js` |
| Jeu entièrement nouveau | Le squelette de ce document |

---

## 8. Checklist avant de livrer

### Fonctionnel
- [ ] `window.GAME_MODULES['mon-jeu']` est déclaré (clé identique à `id` dans le registre)
- [ ] `createSession` retourne les 4 champs obligatoires (`gameId`, `gameName`, `gameEmoji`, `winCondition`)
- [ ] `renderSession` a exactement la signature `(session, container, onEnd, onSave)`
- [ ] `session.onSave()` est appelé après **chaque** modification de l'état de la partie
- [ ] `onEnd()` reçoit un tableau `players` avec `playerId` et `finalScore` pour chacun
- [ ] `session.phase = 'ended'` est positionné avant l'appel à `onEnd()`
- [ ] La session est JSON-sérialisable (aucune fonction, aucune référence DOM)
- [ ] La reprise de partie fonctionne (fermer le navigateur en cours de partie, rouvrir)

### Visuel
- [ ] Fonds uniquement via tokens CSS (`--surface`, `--bg3`, etc.) — aucune valeur hexadécimale en dur
- [ ] Tous les noms et textes utilisateurs passent par `esc()`
- [ ] Tous les sélecteurs CSS ont un préfixe unique (2–4 lettres)
- [ ] Les scores et grands chiffres sont en `var(--ff-display)`, le reste en `var(--ff-body)`
- [ ] Le CSS est à la fin de `main.css`
- [ ] L'interface est lisible sur mobile (320px de large minimum)

### Robustesse
- [ ] La reprise de partie fonctionne correctement
- [ ] L'annulation ne plante pas si `previousState` est null
- [ ] `endGame` ne peut pas être appelée deux fois (garde `phase === 'ended'`)
- [ ] Les inputs numériques sont validés avant utilisation (`isNaN`, bornes min/max)
- [ ] La condition de fin de partie est bien détectée dans tous les cas (y compris égalité)
