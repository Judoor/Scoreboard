/**
 * MODULE FLÉCHETTES CRICKET
 * Interface : sélection multiplicateur + cible (sans dartboard)
 */
window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['dartscricket'] = (() => {
  const CLASSIC_TARGETS = [20, 19, 18, 17, 16, 15, 'Bull'];
  const teamColors = ['#f97316', '#0ea5e9', '#22c55e', '#a855f7', '#f43f5e', '#fbbf24'];

  function createSession(config, players) {
    return {
      gameId: config.id, gameName: config.name,
      gameEmoji: config.emoji, winCondition: config.winCondition,
      players: players.map(p => ({ ...p, playerId: p.id })),
      phase: 'config',
      variant: 'classic', targets: [],
      teams: [], currentTeamIndex: 0,
      history: [], currentTurn: null, undoStack: [],
    };
  }

  function renderSession(session, container, onEnd, onSave) {
    session.onEnd = onEnd;
    session.onSave = onSave || (() => {});
    if (!Array.isArray(session.undoStack)) session.undoStack = [];
    if (session.phase === 'config') renderConfig(session, container);
    else renderGame(session, container);
  }

  function renderConfig(session, container) {
    const players = session.players;
    container.innerHTML = `<div class="dc-wrap"><div class="dt3-config">
      <div class="dt3-config-title">🏹 Configuration Cricket</div>
      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Variante</label>
        <div class="dc-variants">
          <button class="dc-variant active" data-variant="classic"><div class="dc-variant-name">Cricket classique</div></button>
          <button class="dc-variant" data-variant="cutthroat"><div class="dc-variant-name">Cut Throat</div></button>
          <button class="dc-variant" data-variant="random"><div class="dc-variant-name">Cricket aléatoire</div></button>
        </div>
      </div>
      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Mode de jeu</label>
        <div class="dt3-presets">
          <button class="dt3-preset active" data-mode="solo">👤 Individuel</button>
          <button class="dt3-preset" data-mode="team">👥 Équipes</button>
        </div>
      </div>
      <div class="dt3-config-section" id="dcTeamSizeSection" style="display:none">
        <label class="dt3-cfg-label">Joueurs par équipe</label>
        <div class="dt3-presets">
          ${[2, 3, 4].map(n => `<button class="dt3-preset ${n === 2 ? 'active' : ''}" data-size="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Ordre de jeu</label>
        <div class="dt3-pick-grid" id="dcPickGrid"></div>
      </div>
      <button class="dt3-btn dt3-btn-start" id="dcStart" disabled>Lancer la partie →</button>
    </div></div>`;

    let variant = 'classic';
    let teamMode = false;
    let teamSize = 2;
    const order = [];

    const renderPick = () => {
      const grid = container.querySelector('#dcPickGrid');
      grid.innerHTML = players.map((p, i) => {
        const pos = order.indexOf(i);
        let badge = '';
        if (teamMode && pos !== -1) badge = `<span class="dt3-pick-team" style="background:${teamColors[Math.floor(pos / teamSize)]}">É${Math.floor(pos / teamSize) + 1}</span>`;
        if (!teamMode && pos !== -1) badge = `<span class="dt3-pick-order">${pos + 1}</span>`;
        return `<div class="dt3-pick-card ${pos !== -1 ? 'selected' : ''}" data-idx="${i}" style="--pc:${p.color}">
          <span class="dt3-pick-avatar">${p.avatar}</span><span class="dt3-pick-name">${esc(p.name)}</span>${badge}
        </div>`;
      }).join('');
      grid.querySelectorAll('.dt3-pick-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = Number(card.dataset.idx);
          const pos = order.indexOf(idx);
          if (pos !== -1) order.splice(pos, 1);
          else if (order.length < players.length) order.push(idx);
          renderPick();
          checkStart();
        });
      });
    };

    const checkStart = () => {
      const valid = teamMode ? (order.length >= teamSize * 2 && order.length % teamSize === 0) : (order.length === players.length);
      container.querySelector('#dcStart').disabled = !valid;
    };

    container.querySelectorAll('.dc-variant').forEach(btn => btn.addEventListener('click', () => {
      container.querySelectorAll('.dc-variant').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      variant = btn.dataset.variant;
    }));
    container.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      teamMode = btn.dataset.mode === 'team';
      container.querySelector('#dcTeamSizeSection').style.display = teamMode ? '' : 'none';
      container.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      order.length = 0;
      renderPick();
      checkStart();
    }));
    container.querySelectorAll('[data-size]').forEach(btn => btn.addEventListener('click', () => {
      container.querySelectorAll('[data-size]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      teamSize = Number(btn.dataset.size);
      order.length = 0;
      renderPick();
      checkStart();
    }));

    container.querySelector('#dcStart').addEventListener('click', () => {
      session.variant = variant;
      if (variant === 'random') {
        const pool = Array.from({ length: 20 }, (_, i) => i + 1);
        const picked = [];
        while (picked.length < 6) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        session.targets = [...picked.sort((a, b) => b - a), 'Bull'];
      } else session.targets = [...CLASSIC_TARGETS];

      const buildTeam = (indices, ti) => ({
        id: teamMode ? `team${ti + 1}` : players[indices[0]].id,
        name: teamMode ? `Équipe ${ti + 1}` : players[indices[0]].name,
        color: teamMode ? teamColors[ti] : players[indices[0]].color,
        members: indices.map(i => ({ ...players[i], playerId: players[i].id })),
        currentMember: 0,
        marks: Object.fromEntries(session.targets.map(t => [String(t), 0])),
        points: 0,
        history: [],
        stats: { dartsThrown: 0, validDarts: 0, marksHit: 0 },
      });
      session.teams = teamMode
        ? Array.from({ length: order.length / teamSize }, (_, t) => buildTeam(order.slice(t * teamSize, (t + 1) * teamSize), t))
        : order.map((i, idx) => buildTeam([i], idx));
      session.currentTeamIndex = 0;
      session.currentTurn = { darts: [], selectedMult: 'single' };
      session.undoStack = [];
      session.phase = 'playing';
      session.onSave();
      renderGame(session, container);
    });

    renderPick();
    checkStart();
  }

  function renderGame(session, container) {
    if (!session.currentTurn) session.currentTurn = { darts: [], selectedMult: 'single' };
    const team = session.teams[session.currentTeamIndex];
    container.innerHTML = `<div class="dc-wrap">
      <div class="dt3-msgbar" id="dcMsgbar"></div>
      <div class="dc-variant-badge">${variantLabel(session.variant)}</div>
      <div class="dc-scores-row" id="dcScoresRow"></div>
      <div class="dt3-board-section">
        <div class="dt3-turn-header">
          <div class="dt3-turn-label" id="dcTurnLabel"></div>
          <div class="dt3-darts-track" id="dcDartsTrack"></div>
        </div>
        <div class="dt3-shot-panel">
          <div class="dt3-mult-row">
            <button class="dt3-btn dc-mult-btn" data-mult="double">Double</button>
            <button class="dt3-btn dc-mult-btn" data-mult="triple">Triple</button>
          </div>
          <div class="dt3-num-grid">
            ${session.targets.map(t => `<button class="dt3-btn dc-target-btn2" data-target="${t}">${t === 'Bull' ? 'Bull' : t}</button>`).join('')}
          </div>
        </div>
        <div class="dt3-board-actions">
          <button class="dt3-btn dt3-btn-miss" id="dcBtnMiss">Manqué</button>
          <button class="dt3-btn dt3-btn-undo" id="dcBtnUndo" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
        </div>
      </div>
      <div class="dc-grid-wrap"><div class="dc-grid" id="dcGrid"></div></div>
    </div>`;

    container.querySelectorAll('.dc-mult-btn').forEach(btn => btn.addEventListener('click', () => {
      session.currentTurn.selectedMult = btn.dataset.mult;
      refreshMultButtons(session, container);
    }));
    container.querySelectorAll('.dc-target-btn2').forEach(btn => btn.addEventListener('click', () => {
      const target = btn.dataset.target === 'Bull' ? 'Bull' : Number(btn.dataset.target);
      onDartCricket(session, container, target, session.currentTurn.selectedMult || 'single');
    }));
    container.querySelector('#dcBtnMiss').addEventListener('click', () => onDartCricket(session, container, null, 'miss'));
    container.querySelector('#dcBtnUndo').addEventListener('click', () => undoThrow(session, container));
    refreshCricketUI(session, container);
  }

  function onDartCricket(session, container, sector, ring) {
    const turn = session.currentTurn;
    if (turn.darts.length >= 3) return;
    pushUndo(session);
    const team = session.teams[session.currentTeamIndex];
    team.stats.dartsThrown++;

    if (ring === 'miss' || sector === null) {
      turn.darts.push({ sector: null, ring: 'miss', touches: 0, targetStr: null });
    } else {
      const targetStr = sector === 'Bull' ? 'Bull' : String(sector);
      const isTarget = session.targets.some(t => String(t) === targetStr);
      if (!isTarget) {
        turn.darts.push({ sector, ring, touches: 0, targetStr: null, offTarget: true });
      } else {
        let touches = ring === 'triple' ? 3 : ring === 'double' ? 2 : 1;
        if (targetStr === 'Bull') touches = ring === 'double' ? 2 : 1;
        turn.darts.push({ sector, ring, touches, targetStr });
        team.stats.validDarts++;
        team.stats.marksHit += touches;
      }
      session.currentTurn.selectedMult = 'single';
    }

    if (turn.darts.length === 3) commitCricketTurn(session, container);
    else refreshCricketUI(session, container);
    session.onSave();
  }

  function commitCricketTurn(session, container) {
    const turn = session.currentTurn;
    const team = session.teams[session.currentTeamIndex];
    const isCT = session.variant === 'cutthroat';
    turn.darts.forEach(d => {
      if (!d.targetStr || !d.touches) return;
      const ts = d.targetStr;
      if (session.teams.every(t => (t.marks[ts] || 0) >= 3)) return;
      const prev = team.marks[ts] || 0;
      const next = prev + d.touches;
      team.marks[ts] = next;
      if (prev < 3 && next > 3) applyPoints(session, team, ts, next - 3, isCT);
      else if (prev >= 3) applyPoints(session, team, ts, d.touches, isCT);
    });
    session.history.push({ teamId: team.id, teamName: team.name, darts: turn.darts });
    team.history.push({ darts: turn.darts });
    team.currentMember = (team.currentMember + 1) % team.members.length;
    session.currentTeamIndex = (session.currentTeamIndex + 1) % session.teams.length;
    session.currentTurn = { darts: [], selectedMult: 'single' };
    session.onSave();
    if (checkWin(session)) return setTimeout(() => endGame(session), 300);
    renderGame(session, container);
  }

  function applyPoints(session, team, targetStr, bonus, isCT) {
    const val = targetStr === 'Bull' ? 25 : Number(targetStr);
    const pts = bonus * val;
    if (isCT) {
      session.teams.forEach(t => {
        if (t.id !== team.id && (t.marks[targetStr] || 0) < 3) t.points += pts;
      });
    } else {
      const opponentsClosed = session.teams.every(t => t.id === team.id || (t.marks[targetStr] || 0) >= 3);
      if (!opponentsClosed) team.points += pts;
    }
  }

  function checkWin(session) {
    const isCT = session.variant === 'cutthroat';
    if (!session.targets.every(t => session.teams.some(te => te.marks[String(t)] >= 3))) return false;
    if (isCT) {
      const min = Math.min(...session.teams.map(t => t.points));
      return session.teams.some(t => t.points === min);
    }
    return session.teams.some(t =>
      session.targets.every(ta => t.marks[String(ta)] >= 3) &&
      t.points >= Math.max(...session.teams.map(x => x.points))
    );
  }

  function pushUndo(session) {
    session.undoStack.push({
      teams: JSON.parse(JSON.stringify(session.teams)),
      currentTeamIndex: session.currentTeamIndex,
      history: JSON.parse(JSON.stringify(session.history)),
      currentTurn: JSON.parse(JSON.stringify(session.currentTurn)),
    });
  }

  function undoThrow(session, container) {
    if (!session.undoStack.length) return;
    const prev = session.undoStack.pop();
    session.teams = prev.teams;
    session.currentTeamIndex = prev.currentTeamIndex;
    session.history = prev.history;
    session.currentTurn = prev.currentTurn || { darts: [], selectedMult: 'single' };
    session.onSave();
    renderGame(session, container);
  }

  function refreshMultButtons(session, container) {
    const active = session.currentTurn?.selectedMult || 'single';
    container.querySelectorAll('.dc-mult-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mult === active));
  }

  function refreshCricketUI(session, container) {
    const team = session.teams[session.currentTeamIndex];
    const member = team.members[team.currentMember];
    const label = container.querySelector('#dcTurnLabel');
    if (label) label.innerHTML = `<strong style="color:${team.color}">${esc(member.name)}</strong> — sélectionne une cible`;
    refreshMultButtons(session, container);
    refreshDartsTrackCricket(session, container);
    renderCricketScores(session, container);
    renderCricketGrid(session, container);
  }

  function refreshDartsTrackCricket(session, container) {
    const turn = session.currentTurn;
    const team = session.teams[session.currentTeamIndex];
    const track = container.querySelector('#dcDartsTrack');
    if (!track) return;
    const slots = [0, 1, 2].map(i => {
      const d = turn.darts[i];
      if (!d) return `<div class="dt3-dart-slot empty"><span>🎯</span></div>`;
      if (d.ring === 'miss') return `<div class="dt3-dart-slot filled" style="--pc:${team.color}"><span class="dt3-dart-label">Manqué</span><span class="dt3-dart-val">—</span></div>`;
      if (d.offTarget) return `<div class="dt3-dart-slot filled" style="--pc:${team.color}"><span class="dt3-dart-label">${d.sector}</span><span class="dt3-dart-val">Hors cible</span></div>`;
      const base = d.targetStr === 'Bull' ? 'Bull' : d.sector;
      const lbl = d.ring === 'double' ? `D${base}` : d.ring === 'triple' ? `T${base}` : `${base}`;
      return `<div class="dt3-dart-slot filled" style="--pc:${team.color}"><span class="dt3-dart-label">${lbl}</span><span class="dt3-dart-val">×${d.touches}</span></div>`;
    }).join('');
    track.innerHTML = `<div class="dt3-darts-slots">${slots}</div>`;
  }

  function renderCricketScores(session, container) {
    const el = container.querySelector('#dcScoresRow');
    if (!el) return;
    el.innerHTML = session.teams.map((t, i) => {
      const st = t.stats || {};
      const thrown = st.dartsThrown || 0;
      const valid = st.validDarts || 0;
      const avgValidPer3 = thrown ? ((valid / thrown) * 3).toFixed(2) : '0.00';
      return `<div class="dc-score-chip ${i === session.currentTeamIndex ? 'active' : ''}" style="--pc:${t.color}">
        <span>${t.members.length > 1 ? '👥' : t.members[0].avatar}</span>
        <span class="dc-chip-name">${esc(t.name)}</span>
        <span class="dc-chip-pts">${t.points} pts</span>
        <span class="dc-chip-pts">${avgValidPer3}</span>
      </div>`;
    }).join('');
  }

  function renderCricketGrid(session, container) {
    const grid = container.querySelector('#dcGrid');
    if (!grid) return;
    const isCT = session.variant === 'cutthroat';
    let html = `<div class="dc-grid-header"><div class="dc-gh-target">Cible</div>${session.teams.map(t => `<div class="dc-gh-team" style="--pc:${t.color}"><span>${esc(t.name)}</span></div>`).join('')}</div>`;
    html += session.targets.map(target => {
      const ts = String(target);
      const allClosed = session.teams.every(t => t.marks[ts] >= 3);
      const cells = session.teams.map(t => {
        const m = t.marks[ts] || 0;
        const icon = m === 0
          ? ''
          : m === 1
            ? '<span class="dc-mark1">/</span>'
            : m === 2
              ? '<span class="dc-mark2">//</span>'
              : '<span class="dc-mark3">✕</span>';
        return `<div class="dc-cell ${m >= 3 ? 'closed' : ''}" style="--pc:${t.color}">${icon}</div>`;
      }).join('');
      return `<div class="dc-row ${allClosed ? 'all-closed' : ''}"><div class="dc-row-target">${target === 'Bull' ? '🎯' : target}</div>${cells}</div>`;
    }).join('');
    html += `<div class="dc-row dc-score-row"><div class="dc-row-target"><strong>${isCT ? '⚠️ Points' : 'Points'}</strong></div>${session.teams.map(t => `<div class="dc-cell dc-score-cell" style="--pc:${t.color}"><strong>${t.points}</strong></div>`).join('')}</div>`;
    grid.innerHTML = html;
  }

  function endGame(session) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    const isCT = session.variant === 'cutthroat';
    const sorted = [...session.teams].sort((a, b) => isCT ? a.points - b.points : b.points - a.points);
    session.onEnd({
      gameId: session.gameId, gameName: session.gameName,
      gameEmoji: session.gameEmoji, winCondition: isCT ? 'lowest' : 'highest',
      players: sorted.map(t => ({
        playerId: t.id, name: t.name, finalScore: t.points,
        stats: {
          dartsThrown: t.stats?.dartsThrown || 0,
          validDarts: t.stats?.validDarts || 0,
          marksHit: t.stats?.marksHit || 0,
        },
      })),
      rounds: session.history.length, duration: null,
    });
  }

  function variantLabel(v) {
    return { classic: '🎯 Cricket classique', cutthroat: '⚔️ Cut Throat', random: '🎲 Cricket aléatoire' }[v] || '';
  }

  return { createSession, renderSession };
})();
