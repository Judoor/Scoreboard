window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['tarot'] = (() => {
  const CONTRACTS = [
    { id: 'prise', label: 'Prise x1', mult: 1 },
    { id: 'garde', label: 'Garde x2', mult: 2 },
    { id: 'garde-sans', label: 'Garde Sans x4', mult: 4 },
    { id: 'garde-contre', label: 'Garde Contre x6', mult: 6 },
  ];
  const TARGET_BY_BOUTS = [56, 51, 41, 36];

  function createSession(config, players) {
    return {
      gameId: config.id,
      gameName: config.name,
      gameEmoji: config.emoji,
      winCondition: config.winCondition,
      phase: 'playing',
      round: 1,
      players: players.map(p => ({
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        score: 0,
        history: [],
      })),
      history: [],
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
    container.innerHTML = `<div class="tb-wrap">
      <div class="tb-msg" id="tbMsg"></div>
      <div class="tb-scores">${session.players.map(p => `
        <div class="tb-card" style="--pc:${p.color}">
          <div class="tb-name">${p.avatar} ${esc(p.name)}</div>
          <div class="tb-score">${p.score}</div>
        </div>`).join('')}
      </div>
      <div class="tb-form">
        <div class="tb-title">Manche ${session.round}</div>
        <label>Preneur</label>
        <select id="tbTaker">${session.players.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select>
        <label>Contrat</label>
        <select id="tbContract">${CONTRACTS.map(c => `<option value="${c.mult}">${c.label}</option>`).join('')}</select>
        <div class="tb-row">
          <div><label>Bouts (0-3)</label><input type="number" id="tbBouts" min="0" max="3" value="0"/></div>
          <div><label>Points réalisés</label><input type="number" id="tbPoints" min="0" max="91" value="0"/></div>
        </div>
        <label><input type="checkbox" id="tbPetit"/> Petit au bout (+/-10 côté gagnant)</label>
        <div class="tb-actions">
          <button class="tb-btn-main" id="tbAdd">Valider la manche</button>
          <button class="tb-btn-secondary" id="tbUndo" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
          <button class="tb-btn-secondary" id="tbEnd">Terminer</button>
        </div>
      </div>
      <div class="tb-history">${renderHistory(session)}</div>
    </div>`;

    container.querySelector('#tbAdd').addEventListener('click', () => addRound(session, container));
    container.querySelector('#tbUndo').addEventListener('click', () => undo(session, container));
    container.querySelector('#tbEnd').addEventListener('click', () => endGame(session));
  }

  function renderHistory(session) {
    if (!session.history.length) return '<div class="tb-empty">Aucune manche.</div>';
    return session.history.slice(-10).reverse().map(h => `
      <div class="tb-hrow">
        <div class="tb-hleft">M${h.round} · ${esc(h.takerName)} · x${h.mult}</div>
        <div class="tb-hright">${h.base >= 0 ? '+' : ''}${h.base}</div>
      </div>`).join('');
  }

  function addRound(session, container) {
    const takerIdx = Number(container.querySelector('#tbTaker').value);
    const mult = Number(container.querySelector('#tbContract').value);
    const bouts = Math.max(0, Math.min(3, Number(container.querySelector('#tbBouts').value)));
    const points = Math.max(0, Math.min(91, Number(container.querySelector('#tbPoints').value)));
    const petit = container.querySelector('#tbPetit').checked;
    if (Number.isNaN(takerIdx) || Number.isNaN(mult) || Number.isNaN(bouts) || Number.isNaN(points)) {
      return showMsg(container, 'Valeurs invalides.', 'error');
    }

    pushUndo(session);
    const target = TARGET_BY_BOUTS[bouts] ?? 56;
    const diff = points - target;
    let base = (25 + Math.abs(diff)) * mult;
    if (diff < 0) base = -base;
    if (petit) base += diff >= 0 ? 10 : -10;

    const n = session.players.length;
    session.players.forEach((p, i) => {
      const delta = i === takerIdx ? base * (n - 1) : -base;
      p.score += delta;
      p.history.push({ round: session.round, delta });
    });

    session.history.push({
      round: session.round,
      takerId: session.players[takerIdx].playerId,
      takerName: session.players[takerIdx].name,
      mult,
      points,
      bouts,
      petit,
      base,
    });
    session.round++;
    session.onSave();
    renderGame(session, container);
  }

  function pushUndo(session) {
    session.undoStack.push(JSON.parse(JSON.stringify({
      round: session.round,
      players: session.players,
      history: session.history,
    })));
  }

  function undo(session, container) {
    if (!session.undoStack.length) return;
    const prev = session.undoStack.pop();
    session.round = prev.round;
    session.players = prev.players;
    session.history = prev.history;
    session.onSave();
    renderGame(session, container);
  }

  function endGame(session) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    session.onEnd({
      gameId: session.gameId,
      gameName: session.gameName,
      gameEmoji: session.gameEmoji,
      winCondition: 'highest',
      players: session.players.map(p => ({
        playerId: p.playerId,
        name: p.name,
        finalScore: p.score,
      })),
      rounds: session.round - 1,
      duration: null,
    });
  }

  let timer;
  function showMsg(container, msg, type = 'info') {
    const el = container.querySelector('#tbMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = `tb-msg tb-msg-${type} show`;
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  return { createSession, renderSession };
})();
