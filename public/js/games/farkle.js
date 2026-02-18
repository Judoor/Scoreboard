/**
 * MODULE FARKLE v3
 * Saisie manuelle, Main Chaude, Annuler, 3 Farkles = -1000pts
 * Score max configurable, joueurs illimités, reprise de partie
 */
window.GAME_MODULES = window.GAME_MODULES || {};

window.GAME_MODULES['farkle'] = (() => {

  function createSession(config, players) {
    return {
      gameId:       config.id,
      gameName:     config.name,
      gameEmoji:    config.emoji,
      winCondition: config.winCondition,
      targetScore:  config.targetScore || 10000,
      players: players.map(p => ({
        playerId:           p.id,
        name:               p.name,
        avatar:             p.avatar,
        color:              p.color,
        score:              0,
        consecutiveFarkles: 0,
      })),
      currentIndex:      0,
      gameHasWinner:     false,
      finalPlayerIndex:  -1,
      turnsRemaining:    -1,
      previousState:     null,
      phase:             'config', // 'config' | 'playing' | 'ended'
    };
  }

  function renderSession(session, container, onEnd, onSave) {
    session.onEnd  = onEnd;
    session.onSave = onSave || (() => {});
    // Si la session est déjà en cours (reprise), on saute la config
    if (session.phase === 'playing') {
      renderGame(session, container);
    } else if (session.phase === 'config') {
      renderConfig(session, container);
    } else {
      renderConfig(session, container);
    }
  }

  // ── PHASE CONFIG ─────────────────────────────────────────────────────────
  function renderConfig(session, container) {
    container.innerHTML = `
      <div class="fk2-wrap">
        <div class="fk2-config-box">
          <div class="fk2-config-title">🎲 Configuration Farkle</div>
          <div class="fk2-config-group">
            <label>Score à atteindre</label>
            <div class="fk2-config-presets">
              <button class="fk2-preset active" data-val="5000">5 000</button>
              <button class="fk2-preset" data-val="10000">10 000</button>
              <button class="fk2-preset" data-val="15000">15 000</button>
              <button class="fk2-preset" data-val="20000">20 000</button>
            </div>
            <input type="number" class="fk2-config-input" id="fk2TargetInput"
              value="${session.targetScore}" min="500" step="500" />
          </div>
          <div class="fk2-config-players">
            <div class="fk2-config-players-title">Joueurs (${session.players.length})</div>
            ${session.players.map(p => `
              <div class="fk2-cfg-player" style="--pc:${p.color}">
                <span>${p.avatar}</span><span>${esc(p.name)}</span>
              </div>`).join('')}
          </div>
          <button class="fk2-btn fk2-btn-validate" id="fk2BtnStart" style="width:100%;padding:14px;font-size:1rem">
            Lancer la partie →
          </button>
        </div>
      </div>`;

    // Presets
    container.querySelectorAll('.fk2-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.fk2-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        container.querySelector('#fk2TargetInput').value = btn.dataset.val;
      });
    });
    // Sync input → reset preset highlight
    container.querySelector('#fk2TargetInput').addEventListener('input', () => {
      container.querySelectorAll('.fk2-preset').forEach(b => b.classList.remove('active'));
    });

    container.querySelector('#fk2BtnStart').addEventListener('click', () => {
      const val = parseInt(container.querySelector('#fk2TargetInput').value) || 10000;
      session.targetScore = Math.max(500, val);
      session.phase = 'playing';
      renderGame(session, container);
    });
  }

  // ── PHASE JEU ────────────────────────────────────────────────────────────
  function renderGame(session, container) {
    container.innerHTML = `
      <div class="fk2-wrap">
        <div class="fk2-msgbar" id="fk2Msgbar"></div>
        <div class="fk2-scoreboard" id="fk2Scoreboard"></div>
        <div class="fk2-controls">
          <div class="fk2-turn-label" id="fk2TurnLabel"></div>
          <input type="number" class="fk2-score-input" id="fk2Input"
            placeholder="Score du tour" inputmode="numeric" min="0" />
          <div class="fk2-btn-row">
            <button class="fk2-btn fk2-btn-validate" id="fk2BtnValidate">✔ Valider</button>
            <button class="fk2-btn fk2-btn-hot"      id="fk2BtnHot">🔥 Main Chaude</button>
            <button class="fk2-btn fk2-btn-undo"     id="fk2BtnUndo" disabled>↩ Annuler</button>
          </div>
          <div class="fk2-btn-row fk2-util-row">
            <button class="fk2-btn fk2-btn-rules" id="fk2BtnRules">📖 Règles</button>
          </div>
        </div>
        <div class="fk2-modal-overlay" id="fk2RulesModal">
          <div class="fk2-modal-box">
            <button class="fk2-modal-close" id="fk2ModalClose">×</button>
            <h2>Règles de score — Farkle</h2>
            <table class="fk2-rules-table">
              <tr><td>1 seul</td><td>100 pts</td></tr>
              <tr><td>5 seul</td><td>50 pts</td></tr>
              <tr><td colspan="2"><hr></td></tr>
              <tr><td>Brelan de 1</td><td>1 000 pts</td></tr>
              <tr><td>Brelan de 2</td><td>200 pts</td></tr>
              <tr><td>Brelan de 3</td><td>300 pts</td></tr>
              <tr><td>Brelan de 4</td><td>400 pts</td></tr>
              <tr><td>Brelan de 5</td><td>500 pts</td></tr>
              <tr><td>Brelan de 6</td><td>600 pts</td></tr>
              <tr><td colspan="2"><hr></td></tr>
              <tr><td>4 dés identiques</td><td>Brelan × 2</td></tr>
              <tr><td>5 dés identiques</td><td>Brelan × 3</td></tr>
              <tr><td>6 dés identiques</td><td>Brelan × 4</td></tr>
              <tr><td colspan="2"><hr></td></tr>
              <tr><td>Suite 1–2–3–4–5–6</td><td>1 500 pts</td></tr>
              <tr><td>3 paires</td><td>1 000 pts</td></tr>
            </table>
            <p class="fk2-rules-penalty">
              ⚠️ <strong>3 Farkles consécutifs</strong> = pénalité <strong>−1 000 pts</strong><br>
              Le score peut devenir négatif.
            </p>
          </div>
        </div>
      </div>`;

    bindGameEvents(session, container);
    // Render scoreboard THEN label so index is consistent
    refreshUI(session, container);
    container.querySelector('#fk2Input').focus();
  }

  function bindGameEvents(session, container) {
    container.querySelector('#fk2BtnValidate').addEventListener('click', () => processTurnEnd(session, container));
    container.querySelector('#fk2BtnHot').addEventListener('click',      () => processHotHand(session, container));
    container.querySelector('#fk2BtnUndo').addEventListener('click',     () => undoLast(session, container));
    container.querySelector('#fk2Input').addEventListener('keydown', e => {
      if (e.key === 'Enter') processTurnEnd(session, container);
    });
    const modal = container.querySelector('#fk2RulesModal');
    container.querySelector('#fk2BtnRules').addEventListener('click',   () => modal.classList.add('active'));
    container.querySelector('#fk2ModalClose').addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
  }

  // ── STATE ────────────────────────────────────────────────────────────────
  function saveState(session, container) {
    session.previousState = {
      players:          JSON.parse(JSON.stringify(session.players)),
      currentIndex:     session.currentIndex,
      gameHasWinner:    session.gameHasWinner,
      finalPlayerIndex: session.finalPlayerIndex,
      turnsRemaining:   session.turnsRemaining,
    };
    const btn = container.querySelector('#fk2BtnUndo');
    if (btn) btn.disabled = false;
  }

  function undoLast(session, container) {
    if (!session.previousState) { showMsg(container, 'Rien à annuler !', 'error'); return; }
    Object.assign(session, session.previousState);
    session.previousState = null;
    container.querySelector('#fk2BtnUndo').disabled = true;
    container.querySelector('#fk2Input').value = '';
    refreshUI(session, container);
    showMsg(container, 'Action annulée.', 'info');
  }

  // ── LOGIC ────────────────────────────────────────────────────────────────
  function processHotHand(session, container) {
    const input = container.querySelector('#fk2Input');
    const score = parseInt(input.value) || 0;
    if (score === 0) { showMsg(container, "Impossible de faire 'Main Chaude' avec un score de 0 !", 'error'); return; }
    saveState(session, container);
    const player = session.players[session.currentIndex];
    player.score += score;
    player.consecutiveFarkles = 0;
    input.value = '';
    input.focus();
    showMsg(container, `🔥 MAIN CHAUDE ! ${player.name} marque ${score} pts et rejoue !`, 'info');
    // Same player stays active — just refresh scores, not index
    renderScoreboard(session, container);
    session.onSave();
  }

  function processTurnEnd(session, container) {
    const input  = container.querySelector('#fk2Input');
    const score  = parseInt(input.value) || 0;
    const player = session.players[session.currentIndex];

    saveState(session, container);
    input.value = '';

    if (score === 0) {
      player.consecutiveFarkles++;
      if (player.consecutiveFarkles >= 3) {
        player.score -= 1000;
        player.consecutiveFarkles = 0;
        showMsg(container, `💀 PÉNALITÉ ! ${player.name} perd 1 000 pts ! (3 farkles d'affilée)`, 'error');
      } else {
        showMsg(container, `😬 FARKLE ! ${player.name} — ${player.consecutiveFarkles}/3 d'affilée`, 'warning');
      }
    } else {
      player.score += score;
      player.consecutiveFarkles = 0;
    }

    // Dernier tour déclenché ?
    if (player.score >= session.targetScore && !session.gameHasWinner) {
      session.gameHasWinner    = true;
      session.finalPlayerIndex = session.currentIndex;
      session.turnsRemaining   = session.players.length - 1;
      showMsg(container, `🎉 ${player.name} atteint ${player.score.toLocaleString()} pts ! DERNIER TOUR pour les autres !`, 'info');
      advancePlayer(session);
      refreshUI(session, container);
      session.onSave();
      return;
    }

    if (session.gameHasWinner) {
      session.turnsRemaining--;
      if (session.turnsRemaining <= 0) {
        refreshUI(session, container);
        endGame(session, container);
        return;
      }
    }

    advancePlayer(session);
    if (session.gameHasWinner && session.currentIndex === session.finalPlayerIndex) {
      refreshUI(session, container);
      endGame(session, container);
      return;
    }

    refreshUI(session, container);
    session.onSave();
    container.querySelector('#fk2Input').focus();
  }

  // Avance l'index SANS toucher au DOM — le render se fait après
  function advancePlayer(session) {
    session.currentIndex = (session.currentIndex + 1) % session.players.length;
  }

  // Render complet : scoreboard + label (index déjà à jour)
  function refreshUI(session, container) {
    renderScoreboard(session, container);
    updateTurnLabel(session, container);
  }

  function endGame(session, container) {
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
      rounds:   null,
      duration: null,
    });
  }

  // ── DISPLAY ──────────────────────────────────────────────────────────────
  function renderScoreboard(session, container) {
    const sb = container.querySelector('#fk2Scoreboard');
    if (!sb) return;
    // Ordre de jeu original — pas de tri par score
    sb.innerHTML = session.players.map((p, i) => {
      const isActive = i === session.currentIndex;
      const isFinal  = session.gameHasWinner && i !== session.finalPlayerIndex;
      const pct      = Math.max(0, Math.min(100, Math.round((p.score / session.targetScore) * 100)));
      const negative = p.score < 0;
      return `
        <div class="fk2-card ${isActive ? 'active' : ''} ${isFinal ? 'final' : ''}" style="--pc:${p.color}">
          <div class="fk2-card-top">
            <span class="fk2-card-avatar">${p.avatar}</span>
            <span class="fk2-card-name">${esc(p.name)}</span>
            ${p.consecutiveFarkles > 0 ? `<span class="fk2-farkle-streak">💀×${p.consecutiveFarkles}</span>` : ''}
          </div>
          <div class="fk2-card-score ${negative ? 'negative' : ''}">${p.score.toLocaleString()}</div>
          <div class="fk2-card-bar">
            <div class="fk2-card-fill" style="width:${negative ? 0 : pct}%"></div>
          </div>
          <div class="fk2-card-target">${p.score.toLocaleString()} / ${session.targetScore.toLocaleString()}</div>
        </div>`;
    }).join('');
  }

  function updateTurnLabel(session, container) {
    const label  = container.querySelector('#fk2TurnLabel');
    if (!label) return;
    const player = session.players[session.currentIndex];
    label.innerHTML = session.gameHasWinner
      ? `<span class="fk2-final-badge">⚠️ DERNIER TOUR</span> — ${esc(player.name)}`
      : `Au tour de <strong style="color:${player.color}">${esc(player.name)}</strong>`;
  }

  let _msgTimer;
  function showMsg(container, msg, type = 'info') {
    const bar = container.querySelector('#fk2Msgbar');
    if (!bar) return;
    bar.textContent = msg;
    bar.className = `fk2-msgbar fk2-msgbar-show fk2-msg-${type}`;
    clearTimeout(_msgTimer);
    _msgTimer = setTimeout(() => bar.classList.remove('fk2-msgbar-show'), 3500);
  }

  return { createSession, renderSession };
})();
