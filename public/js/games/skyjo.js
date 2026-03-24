window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['skyjo'] = (() => {
  function createSession(config, players) {
    return {
      gameId: config.id, gameName: config.name, gameEmoji: config.emoji, winCondition: config.winCondition,
      phase: 'playing', round: 1, targetScore: 100, doubleCloserIfNotLowest: true,
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
    container.innerHTML = `<div class="sj-wrap">
      <div class="sj-scores">${session.players.map(p => `<div class="sj-card" style="--pc:${p.color}">
        <div class="sj-name">${p.avatar} ${esc(p.name)}</div><div class="sj-score">${p.score}</div></div>`).join('')}</div>
      <div class="sj-form">
        <div class="sj-title">Manche ${session.round}</div>
        <div class="sj-row">
          <div><label>Seuil fin</label><input id="sjTarget" type="number" min="50" value="${session.targetScore}"/></div>
          <div><label>Fermeur</label><select id="sjCloser">${session.players.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select></div>
        </div>
        <label><input type="checkbox" id="sjRule" ${session.doubleCloserIfNotLowest ? 'checked' : ''}/> Doubler le score du fermeur s'il n'est pas le plus bas</label>
        <div class="sj-grid">${session.players.map((p, i) => `<div><label>${esc(p.name)}</label><input class="sj-input" data-i="${i}" type="number" value="0"/></div>`).join('')}</div>
        <div class="sj-actions">
          <button id="sjAdd" class="sj-btn-main">Valider manche</button>
          <button id="sjUndo" class="sj-btn-secondary" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
          <button id="sjEnd" class="sj-btn-secondary">Terminer</button>
        </div>
      </div>
    </div>`;
    container.querySelector('#sjAdd').addEventListener('click', () => addRound(session, container));
    container.querySelector('#sjUndo').addEventListener('click', () => undo(session, container));
    container.querySelector('#sjEnd').addEventListener('click', () => endGame(session));
  }

  function addRound(session, container) {
    pushUndo(session);
    session.targetScore = Math.max(50, Number(container.querySelector('#sjTarget').value) || 100);
    session.doubleCloserIfNotLowest = container.querySelector('#sjRule').checked;
    const closer = Number(container.querySelector('#sjCloser').value);
    const scores = [];
    container.querySelectorAll('.sj-input').forEach(inp => scores[Number(inp.dataset.i)] = Number(inp.value) || 0);
    if (session.doubleCloserIfNotLowest) {
      const min = Math.min(...scores);
      if (scores[closer] !== min) scores[closer] *= 2;
    }
    session.players.forEach((p, i) => {
      p.score += scores[i];
      p.history.push(scores[i]);
    });
    session.round++;
    session.onSave();
    renderGame(session, container);
    if (session.players.some(p => p.score >= session.targetScore)) endGame(session);
  }
  function pushUndo(session) {
    session.undoStack.push(JSON.parse(JSON.stringify({
      round: session.round, targetScore: session.targetScore, doubleCloserIfNotLowest: session.doubleCloserIfNotLowest, players: session.players,
    })));
  }
  function undo(session, container) {
    if (!session.undoStack.length) return;
    const prev = session.undoStack.pop();
    session.round = prev.round;
    session.targetScore = prev.targetScore;
    session.doubleCloserIfNotLowest = prev.doubleCloserIfNotLowest;
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
