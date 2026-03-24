window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['qwixx'] = (() => {
  const SCORE_BY_CROSSES = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];

  function createSession(config, players) {
    return {
      gameId: config.id, gameName: config.name, gameEmoji: config.emoji, winCondition: config.winCondition,
      phase: 'playing', round: 1,
      players: players.map(p => ({
        playerId: p.id, name: p.name, avatar: p.avatar, color: p.color,
        rows: { red: 0, yellow: 0, green: 0, blue: 0 },
        penalties: 0, score: 0, history: [],
      })),
      undoStack: [],
    };
  }

  function renderSession(session, container, onEnd, onSave) {
    session.onEnd = onEnd;
    session.onSave = onSave || (() => {});
    if (!Array.isArray(session.undoStack)) session.undoStack = [];
    renderGame(session, container);
  }

  function renderGame(session, container) {
    container.innerHTML = `<div class="qx-wrap">
      <div class="qx-title">Qwixx — Manche ${session.round}</div>
      <div class="qx-grid">
        ${session.players.map((p, i) => `<div class="qx-card" style="--pc:${p.color}">
          <div class="qx-head">${p.avatar} ${esc(p.name)} <span>${p.score} pts</span></div>
          <div class="qx-rows">
            ${['red', 'yellow', 'green', 'blue'].map(c => `<label>${c}<input type="number" min="0" max="11" data-i="${i}" data-row="${c}" value="${p.rows[c]}"/></label>`).join('')}
            <label>pénalités<input type="number" min="0" max="4" data-i="${i}" data-row="penalties" value="${p.penalties}"/></label>
          </div>
        </div>`).join('')}
      </div>
      <div class="qx-actions">
        <button id="qxApply" class="qx-btn-main">Calculer manche</button>
        <button id="qxUndo" class="qx-btn-secondary" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
        <button id="qxEnd" class="qx-btn-secondary">Terminer</button>
      </div>
    </div>`;
    container.querySelector('#qxApply').addEventListener('click', () => applyRound(session, container));
    container.querySelector('#qxUndo').addEventListener('click', () => undo(session, container));
    container.querySelector('#qxEnd').addEventListener('click', () => endGame(session));
  }

  function applyRound(session, container) {
    pushUndo(session);
    container.querySelectorAll('input[data-row]').forEach(inp => {
      const i = Number(inp.dataset.i);
      const row = inp.dataset.row;
      const val = Math.max(0, Number(inp.value) || 0);
      if (row === 'penalties') session.players[i].penalties = Math.min(4, val);
      else session.players[i].rows[row] = Math.min(11, val);
    });
    session.players.forEach(p => {
      const totalRows = ['red', 'yellow', 'green', 'blue'].reduce((sum, r) => sum + (SCORE_BY_CROSSES[p.rows[r]] || 0), 0);
      p.score = totalRows - (p.penalties * 5);
      p.history.push(p.score);
    });
    session.round++;
    session.onSave();
    renderGame(session, container);
  }
  function pushUndo(session) {
    session.undoStack.push(JSON.parse(JSON.stringify({ round: session.round, players: session.players })));
  }
  function undo(session, container) {
    if (!session.undoStack.length) return;
    const prev = session.undoStack.pop();
    session.round = prev.round;
    session.players = prev.players;
    session.onSave();
    renderGame(session, container);
  }
  function endGame(session) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    session.onEnd({
      gameId: session.gameId, gameName: session.gameName, gameEmoji: session.gameEmoji, winCondition: 'highest',
      players: session.players.map(p => ({ playerId: p.playerId, name: p.name, finalScore: p.score })),
      rounds: session.round - 1, duration: null,
    });
  }
  return { createSession, renderSession };
})();
