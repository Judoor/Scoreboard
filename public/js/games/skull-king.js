/**
 * MODULE SKULL KING
 * ─────────────────────────────────────────────────────────────────────────────
 * Description : Jeu de plis — pariez sur le nombre exact de plis que vous
 *               remporterez. Bonus pour cartes spéciales.
 * winCondition : 'highest' (plus de points gagne)
 * Joueurs : 2–8
 */
window.GAME_MODULES = window.GAME_MODULES || {};

window.GAME_MODULES['skull-king'] = (() => {

  // Skull King se joue en 10 manches (rounds 1 à 10).
  // Manche N = N cartes distribuées par joueur.
  const TOTAL_ROUNDS = 10;

  // ─── SESSION ────────────────────────────────────────────────────────────────
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
        // Saisie du tour courant
        bid:      null,   // pari (nombre de plis annoncés)
        won:      null,   // plis réellement remportés
        bonus:    0,      // bonus cartes spéciales (Mermaids, Pirates, Skull King)
        history:  [],     // [{bid, won, bonus, delta}]
      })),

      round:         1,
      // Phase 'bid' : tout le monde annonce ses plis
      // Phase 'won' : saisie des plis remportés + bonus
      subPhase:      'bid',   // 'bid' | 'won'
      currentIndex:  0,       // joueur en cours de saisie
      phase:         'playing',
      previousState: null,
    };
  }

  // ─── RENDER PRINCIPAL ────────────────────────────────────────────────────────
  function renderSession(session, container, onEnd, onSave) {
    session.onEnd  = onEnd;
    session.onSave = onSave || (() => {});
    renderGame(session, container);
  }

  // ─── PHASE JEU ───────────────────────────────────────────────────────────────
  function renderGame(session, container) {
    const isBidPhase = session.subPhase === 'bid';
    const p          = session.players[session.currentIndex];
    const roundCards = session.round; // nb de cartes en main ce tour

    container.innerHTML = `
      <div class="sk-wrap">

        <div class="sk-msg" id="skMsg"></div>

        <!-- Tableau des scores -->
        <div class="sk-scoreboard" id="skScoreboard"></div>

        <!-- Zone de contrôle -->
        <div class="sk-controls">
          <div class="sk-round-info">
            Manche <span class="sk-round-num">${session.round}</span>
            <span class="sk-round-sub">/ ${TOTAL_ROUNDS}</span>
            &nbsp;·&nbsp;
            <span class="sk-phase-label">${isBidPhase ? '📣 Annonces' : '🏁 Résultats'}</span>
          </div>

          <div class="sk-turn-label" id="skTurnLabel"></div>

          ${isBidPhase ? renderBidInput(roundCards) : renderWonInput(roundCards)}

          <div class="sk-btn-row">
            <button class="sk-btn-main" id="skBtnValidate">✔ Valider</button>
            <button class="sk-btn-secondary" id="skBtnUndo" ${session.previousState ? '' : 'disabled'}>↩ Annuler</button>
          </div>
        </div>

        <!-- Récap de la manche en cours -->
        <div class="sk-recap" id="skRecap"></div>

      </div>`;

    // Event listeners
    container.querySelector('#skBtnValidate').addEventListener('click',
      () => processAction(session, container));
    container.querySelector('#skBtnUndo').addEventListener('click',
      () => undoAction(session, container));

    // Validation au clavier
    container.querySelectorAll('input').forEach(inp =>
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') processAction(session, container);
      })
    );

    refreshUI(session, container);

    // Focus sur le premier input
    const firstInput = container.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  function renderBidInput(roundCards) {
    return `
      <div class="sk-input-group">
        <label class="sk-input-label">Nombre de plis annoncés (0 – ${roundCards})</label>
        <input type="number" class="sk-input" id="skBid"
          placeholder="0" inputmode="numeric" min="0" max="${roundCards}"/>
      </div>`;
  }

  function renderWonInput(roundCards) {
    return `
      <div class="sk-input-group">
        <label class="sk-input-label">Plis remportés (0 – ${roundCards})</label>
        <input type="number" class="sk-input" id="skWon"
          placeholder="0" inputmode="numeric" min="0" max="${roundCards}"/>
      </div>
      <div class="sk-input-group">
        <label class="sk-input-label">Bonus cartes spéciales</label>
        <div class="sk-bonus-hint">+30 par Sirène capturée · +20 par Pirate capturé (si Skull King) · +50 Skull King pris par une Sirène</div>
        <input type="number" class="sk-input sk-input-sm" id="skBonus"
          placeholder="0" inputmode="numeric" min="0"/>
      </div>`;
  }

  // ─── REFRESH UI ──────────────────────────────────────────────────────────────
  function refreshUI(session, container) {
    renderScoreboard(session, container);
    renderTurnLabel(session, container);
    renderRecap(session, container);
  }

  function renderScoreboard(session, container) {
    const el = container.querySelector('#skScoreboard');
    if (!el) return;

    el.innerHTML = session.players.map((p, i) => {
      const isActive = i === session.currentIndex;
      const lastDelta = p.history.length
        ? p.history[p.history.length - 1].delta
        : null;
      const deltaHtml = lastDelta !== null
        ? `<span class="sk-delta ${lastDelta >= 0 ? 'pos' : 'neg'}">${lastDelta >= 0 ? '+' : ''}${lastDelta}</span>`
        : '';

      // Afficher le pari si déjà saisi cette manche
      const bidHtml = p.bid !== null
        ? `<div class="sk-card-bid">Pari : <strong>${p.bid}</strong></div>`
        : '';

      return `
        <div class="sk-card ${isActive ? 'active' : ''}" style="--pc:${p.color}">
          <div class="sk-card-head">
            <span class="sk-card-avatar">${p.avatar}</span>
            <span class="sk-card-name">${esc(p.name)}</span>
            ${isActive ? '<span class="sk-turn-dot">●</span>' : ''}
          </div>
          <div class="sk-big-score">${p.score} ${deltaHtml}</div>
          ${bidHtml}
        </div>`;
    }).join('');
  }

  function renderTurnLabel(session, container) {
    const el = container.querySelector('#skTurnLabel');
    if (!el) return;
    const p = session.players[session.currentIndex];
    const action = session.subPhase === 'bid'
      ? 'annonce son pari'
      : 'saisit ses plis remportés';
    el.innerHTML = `<strong style="color:${p.color}">${esc(p.avatar)} ${esc(p.name)}</strong> ${action}`;
  }

  function renderRecap(session, container) {
    const el = container.querySelector('#skRecap');
    if (!el) return;

    // Montrer les joueurs ayant déjà saisi dans cette phase
    const done = session.players.filter(p =>
      session.subPhase === 'bid' ? p.bid !== null : p.won !== null
    );
    if (!done.length) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="sk-recap-title">
        ${session.subPhase === 'bid' ? 'Annonces enregistrées' : 'Résultats en cours'}
      </div>
      <div class="sk-recap-list">
        ${done.map(p => `
          <span class="sk-recap-item" style="--pc:${p.color}">
            ${p.avatar} ${esc(p.name)} :
            ${session.subPhase === 'bid'
              ? `<strong>${p.bid}</strong> pli${p.bid > 1 ? 's' : ''}`
              : `<strong>${p.won}</strong> / pari <strong>${p.bid}</strong>`
            }
          </span>`).join('')}
      </div>`;
  }

  // ─── LOGIQUE ─────────────────────────────────────────────────────────────────
  function processAction(session, container) {
    if (session.subPhase === 'bid') {
      processBid(session, container);
    } else {
      processWon(session, container);
    }
  }

  function processBid(session, container) {
    const input = container.querySelector('#skBid');
    const value = parseInt(input.value);
    const max   = session.round;

    if (isNaN(value) || value < 0 || value > max) {
      showMsg(container, `Pari invalide. Entre 0 et ${max}.`, 'error');
      return;
    }

    saveState(session);

    const p = session.players[session.currentIndex];
    p.bid = value;
    input.value = '';

    // Joueur suivant
    session.currentIndex++;

    if (session.currentIndex >= session.players.length) {
      // Tous ont parié → phase résultats
      session.subPhase   = 'won';
      session.currentIndex = 0;
    }

    session.onSave();
    renderGame(session, container);
  }

  function processWon(session, container) {
    const inputWon   = container.querySelector('#skWon');
    const inputBonus = container.querySelector('#skBonus');
    const won        = parseInt(inputWon.value);
    const bonus      = parseInt(inputBonus.value) || 0;
    const max        = session.round;

    if (isNaN(won) || won < 0 || won > max) {
      showMsg(container, `Nombre de plis invalide. Entre 0 et ${max}.`, 'error');
      return;
    }
    if (isNaN(bonus) || bonus < 0) {
      showMsg(container, 'Bonus invalide.', 'error');
      return;
    }

    saveState(session);

    const p = session.players[session.currentIndex];
    p.won   = won;
    p.bonus = bonus;

    session.currentIndex++;

    if (session.currentIndex >= session.players.length) {
      // Tous ont saisi → calculer les scores
      applyRoundScores(session);
      session.round++;

      if (session.round > TOTAL_ROUNDS) {
        session.onSave();
        renderGame(session, container); // afficher état final un instant
        setTimeout(() => endGame(session), 400);
        return;
      }

      // Réinitialiser pour la prochaine manche
      session.players.forEach(p => { p.bid = null; p.won = null; p.bonus = 0; });
      session.subPhase     = 'bid';
      session.currentIndex = 0;
    }

    session.onSave();
    renderGame(session, container);
  }

  function applyRoundScores(session) {
    session.players.forEach(p => {
      let delta = 0;
      const bid = p.bid;
      const won = p.won;
      const bonus = Number(p.bonus) || 0;

      if (bid === 0) {
        // Pari à 0 : +10×manche si réussi, -10×manche sinon
        delta = (won === 0)
          ? session.round * 10
          : -(session.round * 10);
      } else {
        if (won === bid) {
          // Pari réussi : +20 par pli + bonus
          delta = bid * 20;
        } else {
          // Pari raté : -10 par pli d'écart
          delta = -Math.abs(won - bid) * 10;
        }
      }

      // Le bonus saisi est toujours appliqué, même si le pari est raté ou à 0.
      delta += bonus;

      p.score += delta;
      p.history.push({ bid, won, bonus, delta });
    });
  }

  // ─── ANNULER ─────────────────────────────────────────────────────────────────
  function saveState(session) {
    session.previousState = JSON.parse(JSON.stringify({
      players:      session.players,
      currentIndex: session.currentIndex,
      round:        session.round,
      subPhase:     session.subPhase,
    }));
  }

  function undoAction(session, container) {
    if (!session.previousState) return;
    const prev = session.previousState;
    session.players      = prev.players;
    session.currentIndex = prev.currentIndex;
    session.round        = prev.round;
    session.subPhase     = prev.subPhase;
    session.previousState = null;
    session.onSave();
    renderGame(session, container);
    showMsg(container, 'Saisie annulée.', 'info');
  }

  // ─── FIN DE PARTIE ───────────────────────────────────────────────────────────
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
        finalScore: p.score,
      })),
      rounds:   session.round - 1,
      duration: null,
    });
  }

  // ─── MESSAGE ─────────────────────────────────────────────────────────────────
  let _msgTimer;
  function showMsg(container, text, type = 'info') {
    const el = container.querySelector('#skMsg');
    if (!el) return;
    el.textContent = text;
    el.className = `sk-msg sk-msg-${type} show`;
    clearTimeout(_msgTimer);
    _msgTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ─── EXPORT ───────────────────────────────────────────────────────────────────
  return { createSession, renderSession };

})();
