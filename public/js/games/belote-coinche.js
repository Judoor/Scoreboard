window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['belote-coinche'] = (() => {
  const TARGET = 1000;

  function createSession(config, players) {
    const a = players[0], b = players[1], c = players[2], d = players[3];
    return {
      gameId: config.id,
      gameName: config.name,
      gameEmoji: config.emoji,
      winCondition: config.winCondition,
      phase: 'playing',
      round: 1,
      teams: [
        { id: 'A', name: `${a.name} & ${c.name}`, members: [a, c], score: 0, history: [] },
        { id: 'B', name: `${b.name} & ${d.name}`, members: [b, d], score: 0, history: [] },
      ],
      undoStack: [],
      history: [],
    };
  }

  function renderSession(session, container, onEnd, onSave) {
    session.onEnd = onEnd;
    session.onSave = onSave || (() => {});
    if (!Array.isArray(session.undoStack)) session.undoStack = [];
    renderGame(session, container);
  }

  function renderGame(session, container) {
    container.innerHTML = `<div class="bc-wrap">
      <div class="bc-scores">
        ${session.teams.map((t, i) => `<div class="bc-card ${i===0?'a':'b'}">
          <div class="bc-name">${esc(t.name)}</div><div class="bc-score">${t.score}</div>
        </div>`).join('')}
      </div>
      <div class="bc-form">
        <div class="bc-title">Manche ${session.round}</div>
        <div class="bc-row">
          <div><label>Équipe preneuse</label><select id="bcBidder"><option value="A">Équipe A</option><option value="B">Équipe B</option></select></div>
          <div><label>Contrat</label><input id="bcContract" type="number" min="80" max="250" step="10" value="80"/></div>
        </div>
        <div class="bc-row">
          <div><label>Points équipe A (plis)</label><input id="bcTricksA" type="number" min="0" max="162" value="82"/></div>
          <div><label>Belote A/B</label>
            <select id="bcBelote"><option value="none">Aucune</option><option value="A">A (+20)</option><option value="B">B (+20)</option></select>
          </div>
        </div>
        <div class="bc-row">
          <div><label>Coinche</label><select id="bcMult"><option value="1">Non</option><option value="2">Coinche x2</option><option value="4">Surcoinche x4</option></select></div>
          <div><label>Mode</label><select id="bcMode"><option value="coinche">Coinche</option><option value="classique">Classique</option></select></div>
        </div>
        <div class="bc-actions">
          <button class="bc-btn-main" id="bcAdd">Valider la manche</button>
          <button class="bc-btn-secondary" id="bcUndo" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
          <button class="bc-btn-secondary" id="bcEnd">Terminer</button>
        </div>
      </div>
      <div class="bc-history">${renderHistory(session)}</div>
    </div>`;
    container.querySelector('#bcAdd').addEventListener('click', () => addRound(session, container));
    container.querySelector('#bcUndo').addEventListener('click', () => undo(session, container));
    container.querySelector('#bcEnd').addEventListener('click', () => endGame(session));
  }

  function renderHistory(session) {
    if (!session.history.length) return '<div class="bc-empty">Aucune manche.</div>';
    return session.history.slice(-10).reverse().map(h => `<div class="bc-hrow">
      <span>M${h.round} · ${h.bidder} · c${h.contract} · x${h.mult}</span>
      <strong>${h.addA} / ${h.addB}</strong>
    </div>`).join('');
  }

  function addRound(session, container) {
    const bidder = container.querySelector('#bcBidder').value;
    const contract = Number(container.querySelector('#bcContract').value);
    const tricksA = Math.max(0, Math.min(162, Number(container.querySelector('#bcTricksA').value)));
    const belote = container.querySelector('#bcBelote').value;
    const mult = Number(container.querySelector('#bcMult').value);
    const mode = container.querySelector('#bcMode').value;
    const tricksB = 162 - tricksA;

    pushUndo(session);
    let rawA = tricksA + (belote === 'A' ? 20 : 0);
    let rawB = tricksB + (belote === 'B' ? 20 : 0);
    let addA = rawA;
    let addB = rawB;

    if (mode === 'coinche') {
      const bidderOk = bidder === 'A' ? rawA >= contract : rawB >= contract;
      if (bidderOk) {
        addA = rawA * mult;
        addB = rawB * mult;
      } else {
        // Version pratique feuille: la défense prend tout le pli multiplié.
        if (bidder === 'A') { addA = 0; addB = (162 + (belote !== 'none' ? 20 : 0)) * mult; }
        else { addB = 0; addA = (162 + (belote !== 'none' ? 20 : 0)) * mult; }
      }
    }

    session.teams[0].score += addA;
    session.teams[1].score += addB;
    session.teams[0].history.push(addA);
    session.teams[1].history.push(addB);
    session.history.push({ round: session.round, bidder, contract, rawA, rawB, mult, mode, addA, addB });
    session.round++;
    session.onSave();
    renderGame(session, container);

    if (session.teams.some(t => t.score >= TARGET)) endGame(session);
  }

  function pushUndo(session) {
    session.undoStack.push(JSON.parse(JSON.stringify({
      round: session.round,
      teams: session.teams,
      history: session.history,
    })));
  }
  function undo(session, container) {
    if (!session.undoStack.length) return;
    const prev = session.undoStack.pop();
    session.round = prev.round;
    session.teams = prev.teams;
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
      players: session.teams.map(t => ({ playerId: t.id, name: t.name, finalScore: t.score })),
      rounds: session.round - 1,
      duration: null,
    });
  }

  return { createSession, renderSession };
})();
