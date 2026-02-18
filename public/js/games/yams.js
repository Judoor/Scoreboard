/**
 * MODULE YAMS
 * ─────────────────────────────────────────────────────────────────────────────
 * Grille de score complète, saisie manuelle, pas de dés virtuels.
 *
 * Section supérieure : 1s à 6s + bonus +35 si total ≥ 63
 * Section inférieure : Brelan, Carré, Full House(25), Petite Suite(30),
 *                      Grande Suite(40), Yams(50), Chance
 *
 * Interface :
 *  - Vue globale : toutes les fiches côte à côte
 *  - Clic sur un joueur → sa fiche en plein écran, les autres masquées
 *  - Cases grisées pour les joueurs ayant déjà joué leur tour
 *  - Clic sur une case vide → popup : saisir un score OU barrer
 *  - Cases remplies/barrées verrouillées
 *  - Totaux calculés automatiquement
 */

window.GAME_MODULES = window.GAME_MODULES || {};

window.GAME_MODULES['yams'] = (() => {

  // ── DÉFINITION DES LIGNES ────────────────────────────────────────────────
  const UPPER = [
    { id: 'ones',   label: '1s',   hint: 'Total des 1',  fixed: null },
    { id: 'twos',   label: '2s',   hint: 'Total des 2',  fixed: null },
    { id: 'threes', label: '3s',   hint: 'Total des 3',  fixed: null },
    { id: 'fours',  label: '4s',   hint: 'Total des 4',  fixed: null },
    { id: 'fives',  label: '5s',   hint: 'Total des 5',  fixed: null },
    { id: 'sixes',  label: '6s',   hint: 'Total des 6',  fixed: null },
  ];
  const LOWER = [
    { id: 'brelan',  label: 'Brelan',       hint: '3 dés identiques — total dés', fixed: null  },
    { id: 'carre',   label: 'Carré',        hint: '4 dés identiques — total dés', fixed: null  },
    { id: 'full',    label: 'Full House',   hint: 'Paire + Brelan',               fixed: 25    },
    { id: 'psmall',  label: 'Petite suite', hint: '4 dés qui se suivent',         fixed: 30    },
    { id: 'plarge',  label: 'Grande suite', hint: '5 dés qui se suivent',         fixed: 40    },
    { id: 'yams',    label: 'Yams',         hint: '5 dés identiques',             fixed: 50    },
    { id: 'chance',  label: 'Chance',       hint: 'Somme des 5 dés',              fixed: null  },
  ];
  const ALL_ROWS = [...UPPER.map(r => r.id), ...LOWER.map(r => r.id)];
  const BONUS_THRESHOLD = 63;
  const BONUS_VALUE     = 35;

  // ── SESSION ─────────────────────────────────────────────────────────────
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
        // Chaque case : null = vide, number = score, 'X' = barrée
        scores: Object.fromEntries(ALL_ROWS.map(id => [id, null])),
        // Combien de cases remplies ce tour (pour détecter si le joueur a joué)
        filledThisTurn: 0,
      })),
      // Tour courant : index du joueur dont c'est le tour (rotation)
      currentTurnIndex: 0,
      // Numéro de manche (1 à 13 — 13 cases par joueur)
      round: 1,
      // Vue : 'all' | playerId
      focusedPlayer: 'all',
      phase: 'playing',
    };
  }

  // ── RENDER PRINCIPAL ────────────────────────────────────────────────────
  function renderSession(session, container, onEnd, onSave) {
    session.onEnd  = onEnd;
    session.onSave = onSave || (() => {});

    container.innerHTML = `<div class="ym-wrap" id="ymWrap"></div>
      <div class="ym-popup-overlay" id="ymPopup" style="display:none"></div>`;

    renderUI(session, container);
  }

  function renderUI(session, container) {
    const wrap = container.querySelector('#ymWrap');
    wrap.innerHTML = '';

    // Header : avatars joueurs cliquables
    const header = document.createElement('div');
    header.className = 'ym-header';
    header.innerHTML = `
      <div class="ym-player-tabs">
        <button class="ym-tab ${session.focusedPlayer === 'all' ? 'active' : ''}" data-focus="all">
          Tous
        </button>
        ${session.players.map(p => `
          <button class="ym-tab ${session.focusedPlayer === p.playerId ? 'active' : ''}"
                  data-focus="${p.playerId}" style="--pc:${p.color}">
            <span>${p.avatar}</span>
            <span class="ym-tab-name">${esc(p.name)}</span>
            <span class="ym-tab-remaining">${remaining(p)} cases</span>
          </button>`).join('')}
      </div>`;
    wrap.appendChild(header);

    header.querySelectorAll('.ym-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        session.focusedPlayer = btn.dataset.focus;
        renderUI(session, container);
      });
    });

    // Grille
    const grid = document.createElement('div');
    grid.className = 'ym-grid';

    const visiblePlayers = session.focusedPlayer === 'all'
      ? session.players
      : session.players.filter(p => p.playerId === session.focusedPlayer);

    visiblePlayers.forEach(p => {
      const card = buildCard(session, p, container);
      grid.appendChild(card);
    });

    wrap.appendChild(grid);

    // Indicateur de tour (vue globale)
    if (session.focusedPlayer === 'all') {
      const cur = session.players[session.currentTurnIndex];
      const turnBadge = document.createElement('div');
      turnBadge.className = 'ym-turn-badge';
      turnBadge.innerHTML = `Tour de <strong style="color:${cur.color}">${esc(cur.name)}</strong> — Manche ${session.round}/13`;
      wrap.insertBefore(turnBadge, grid);
    }
  }

  // ── FICHE D'UN JOUEUR ───────────────────────────────────────────────────
  function buildCard(session, p, container) {
    const cur   = session.players[session.currentTurnIndex];
    const isActive  = p.playerId === cur.playerId;
    const hasPlayed = p.filledThisTurn > 0 && !isActive;
    const isFocused = session.focusedPlayer === p.playerId;

    const card = document.createElement('div');
    card.className = `ym-card ${isActive ? 'active' : ''} ${hasPlayed && !isFocused ? 'played' : ''}`;
    card.style.setProperty('--pc', p.color);

    // En-tête de la carte
    const totals = calcTotals(p);
    card.innerHTML = `
      <div class="ym-card-head">
        <span class="ym-card-avatar">${p.avatar}</span>
        <div class="ym-card-info">
          <div class="ym-card-name">${esc(p.name)}</div>
          <div class="ym-card-total-preview">Total : <strong>${totals.grand}</strong></div>
        </div>
        <div class="ym-card-remaining">${remaining(p)} restantes</div>
      </div>

      <table class="ym-table">
        <thead>
          <tr>
            <th class="ym-th-label">Combinaison</th>
            <th class="ym-th-pts">Pts</th>
            <th class="ym-th-score">Score</th>
          </tr>
        </thead>
        <tbody>
          ${sectionRows(UPPER, p, session, isActive)}
          <tr class="ym-row-subtotal">
            <td colspan="2">Sous-total sup.</td>
            <td>${totals.upper}</td>
          </tr>
          <tr class="ym-row-bonus ${totals.upper >= BONUS_THRESHOLD ? 'bonus-ok' : ''}">
            <td colspan="2">Bonus (≥${BONUS_THRESHOLD}) <span class="ym-bonus-hint">+${BONUS_VALUE}</span></td>
            <td>${totals.upper >= BONUS_THRESHOLD ? BONUS_VALUE : 0}</td>
          </tr>
          <tr class="ym-row-total-upper">
            <td colspan="2"><strong>Total supérieur</strong></td>
            <td><strong>${totals.upperWithBonus}</strong></td>
          </tr>
          <tr class="ym-row-spacer"><td colspan="3"></td></tr>
          ${sectionRows(LOWER, p, session, isActive)}
          <tr class="ym-row-total-lower">
            <td colspan="2"><strong>Total inférieur</strong></td>
            <td><strong>${totals.lower}</strong></td>
          </tr>
          <tr class="ym-row-grand">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>${totals.grand}</strong></td>
          </tr>
        </tbody>
      </table>`;

    // Bind clics sur les cases
    card.querySelectorAll('.ym-cell[data-row]').forEach(cell => {
      cell.addEventListener('click', () => {
        if (!isActive) return; // Seul le joueur actif peut remplir
        const rowId = cell.dataset.row;
        if (p.scores[rowId] !== null) return; // Déjà remplie
        openPopup(session, p, rowId, container);
      });
    });

    return card;
  }

  function sectionRows(rows, p, session, isActive) {
    return rows.map(row => {
      const val = p.scores[row.id];
      const isEmpty   = val === null;
      const isCrossed = val === 'X';
      const isNumber  = typeof val === 'number';
      const isClickable = isActive && isEmpty;

      let cellContent = '';
      if (isCrossed)    cellContent = '<span class="ym-cross">✕</span>';
      else if (isNumber) cellContent = val;
      else if (isClickable) cellContent = '<span class="ym-cell-empty">·</span>';

      return `<tr class="ym-row ${isEmpty && isActive ? 'clickable' : ''} ${isCrossed ? 'crossed' : ''}">
        <td class="ym-td-label" title="${esc(row.hint)}">${esc(row.label)}</td>
        <td class="ym-td-pts">${row.fixed !== null ? row.fixed : '—'}</td>
        <td class="ym-cell ${isEmpty && isActive ? 'empty-active' : ''} ${isCrossed ? 'cell-crossed' : ''}"
            data-row="${row.id}">
          ${cellContent}
        </td>
      </tr>`;
    }).join('');
  }

  // ── POPUP SAISIE ────────────────────────────────────────────────────────
  function openPopup(session, player, rowId, container) {
    const row = [...UPPER, ...LOWER].find(r => r.id === rowId);
    const overlay = container.querySelector('#ymPopup');

    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="ym-popup-box">
        <div class="ym-popup-head">
          <div class="ym-popup-title">${esc(row.label)}</div>
          <div class="ym-popup-hint">${esc(row.hint)}</div>
          ${row.fixed !== null ? `<div class="ym-popup-fixed">Valeur fixe : <strong>${row.fixed} pts</strong></div>` : ''}
        </div>

        ${row.fixed !== null
          ? `<div class="ym-popup-actions">
               <button class="ym-popup-btn ym-popup-score" id="ymPopScore">
                 ✔ Valider ${row.fixed} pts
               </button>
               <button class="ym-popup-btn ym-popup-cross" id="ymPopCross">
                 ✕ Barrer la case
               </button>
             </div>`
          : `<div class="ym-popup-input-wrap">
               <input type="number" class="ym-popup-input" id="ymPopInput"
                 placeholder="Score" min="0" max="999" inputmode="numeric" />
             </div>
             <div class="ym-popup-actions">
               <button class="ym-popup-btn ym-popup-score" id="ymPopScore">✔ Valider</button>
               <button class="ym-popup-btn ym-popup-cross" id="ymPopCross">✕ Barrer</button>
             </div>`
        }
        <button class="ym-popup-cancel" id="ymPopCancel">Annuler</button>
      </div>`;

    // Auto-focus input
    const inp = overlay.querySelector('#ymPopInput');
    if (inp) {
      setTimeout(() => inp.focus(), 50);
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') validate();
      });
    }

    const validate = () => {
      let score;
      if (row.fixed !== null) {
        score = row.fixed;
      } else {
        score = parseInt(inp?.value);
        if (isNaN(score) || score < 0) return;
      }
      fillCell(session, player, rowId, score, container);
      overlay.style.display = 'none';
    };

    overlay.querySelector('#ymPopScore').addEventListener('click', validate);
    overlay.querySelector('#ymPopCross').addEventListener('click', () => {
      fillCell(session, player, rowId, 'X', container);
      overlay.style.display = 'none';
    });
    overlay.querySelector('#ymPopCancel').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }

  // ── REMPLIR UNE CASE ────────────────────────────────────────────────────
  function fillCell(session, player, rowId, value, container) {
    player.scores[rowId] = value;
    player.filledThisTurn++;

    // Passer au joueur suivant (rotation)
    advanceTurn(session);

    session.onSave();

    // Vérifier fin de partie
    if (isGameOver(session)) {
      renderUI(session, container);
      setTimeout(() => endGame(session), 400);
      return;
    }

    renderUI(session, container);
  }

  function advanceTurn(session) {
    // Chercher le prochain joueur qui n'a pas encore joué ce tour
    const n = session.players.length;
    let next = (session.currentTurnIndex + 1) % n;
    let loops = 0;

    // Si tous ont joué (filledThisTurn >= round), on passe à la manche suivante
    const allPlayed = session.players.every(p => p.filledThisTurn >= session.round);
    if (allPlayed) {
      session.round++;
      session.players.forEach(p => p.filledThisTurn = 0);
      // Remettre au premier joueur non terminé
      next = session.players.findIndex(p => remaining(p) > 0);
      if (next === -1) return;
    }

    // Trouver le prochain joueur qui doit encore jouer ce tour
    while (loops < n) {
      const p = session.players[next];
      if (p.filledThisTurn < session.round && remaining(p) > 0) {
        session.currentTurnIndex = next;
        return;
      }
      next = (next + 1) % n;
      loops++;
    }
  }

  function isGameOver(session) {
    return session.players.every(p => remaining(p) === 0);
  }

  function remaining(p) {
    return ALL_ROWS.filter(id => p.scores[id] === null).length;
  }

  // ── CALCULS ──────────────────────────────────────────────────────────────
  function calcTotals(p) {
    const s = p.scores;

    const upperIds = UPPER.map(r => r.id);
    const lowerIds = LOWER.map(r => r.id);

    const sumSection = (ids) => ids.reduce((acc, id) => {
      const v = s[id];
      return acc + (typeof v === 'number' ? v : 0);
    }, 0);

    const upper          = sumSection(upperIds);
    const bonus          = upper >= BONUS_THRESHOLD ? BONUS_VALUE : 0;
    const upperWithBonus = upper + bonus;
    const lower          = sumSection(lowerIds);
    const grand          = upperWithBonus + lower;

    return { upper, bonus, upperWithBonus, lower, grand };
  }

  // ── FIN DE PARTIE ────────────────────────────────────────────────────────
  function endGame(session) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    session.onEnd({
      gameId:       session.gameId,
      gameName:     session.gameName,
      gameEmoji:    session.gameEmoji,
      winCondition: session.winCondition,
      players: session.players.map(p => ({
        playerId:   p.playerId,
        name:       p.name,
        finalScore: calcTotals(p).grand,
      })),
      rounds:   13,
      duration: null,
    });
  }

  return { createSession, renderSession };
})();
