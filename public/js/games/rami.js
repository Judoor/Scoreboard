window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['rami'] = (() => {
  function createSession(config, players) {
    return {
      gameId: config.id, gameName: config.name, gameEmoji: config.emoji, winCondition: config.winCondition,
      phase: 'playing', round: 1, targetScore: 100,
      players: players.map(p => ({ playerId: p.id, name: p.name, avatar: p.avatar, color: p.color, score: 0, history: [] })),
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
    container.innerHTML = `<div class="rm-wrap">
      <div class="rm-scores">${session.players.map(p => `<div class="rm-card" style="--pc:${p.color}">
        <div class="rm-name">${p.avatar} ${esc(p.name)}</div><div class="rm-score">${p.score}</div></div>`).join('')}</div>
      <div class="rm-form">
        <div class="rm-title">Manche ${session.round}</div>
        <label>Seuil fin de partie</label><input id="rmTarget" type="number" min="50" value="${session.targetScore}"/>
        <div class="rm-grid">
          ${session.players.map((p, i) => `<div><label>${esc(p.name)}</label><input type="number" data-i="${i}" class="rm-input" value="0"/></div>`).join('')}
        </div>
        <div class="rm-actions">
          <button id="rmAdd" class="rm-btn-main">Valider la manche</button>
          <button id="rmUndo" class="rm-btn-secondary" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
          <button id="rmEnd" class="rm-btn-secondary">Terminer</button>
        </div>
      </div>
    </div>`;
    container.querySelector('#rmAdd').addEventListener('click', () => addRound(session, container));
    container.querySelector('#rmUndo').addEventListener('click', () => undo(session, container));
    container.querySelector('#rmEnd').addEventListener('click', () => endGame(session));
  }

  function addRound(session, container) {
    pushUndo(session);
    session.targetScore = Math.max(50, Number(container.querySelector('#rmTarget').value) || 100);
    container.querySelectorAll('.rm-input').forEach(inp => {
      const i = Number(inp.dataset.i);
      const add = Number(inp.value) || 0;
      session.players[i].score += add;
      session.players[i].history.push(add);
    });
    session.round++;
    session.onSave();
    renderGame(session, container);
    if (session.players.some(p => p.score >= session.targetScore)) endGame(session);
  }
  function pushUndo(session) {
    session.undoStack.push(JSON.parse(JSON.stringify({ round: session.round, targetScore: session.targetScore, players: session.players })));
  }
  function undo(session, container) {
    if (!session.undoStack.length) return;
    const prev = session.undoStack.pop();
    session.round = prev.round;
    session.targetScore = prev.targetScore;
    session.players = prev.players;
    session.onSave();
    renderGame(session, container);
  }
  function endGame(session) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    session.onEnd({
      gameId: session.gameId, gameName: session.gameName, gameEmoji: session.gameEmoji, winCondition: 'lowest',
      players: session.players.map(p => ({ playerId: p.playerId, name: p.name, finalScore: p.score })),
      rounds: session.round - 1, duration: null,
    });
  }

  return { createSession, renderSession };
})();
