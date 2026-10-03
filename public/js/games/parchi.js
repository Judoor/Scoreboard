/**
 * MODULE FLÉCHETTES PARCHI
 * On monte de 0 jusqu'au score cible (301/501/701), pile.
 * Dépassement : on recule de l'excédent (295 + 10 → 297 en 301).
 * Égalité : après chaque fléchette, tout adversaire ayant le même score retombe à 0.
 */
window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['parchi'] = (() => {

  const teamColors = ['#f97316','#0ea5e9','#22c55e','#a855f7','#f43f5e','#fbbf24'];

  function createSession(config, players) {
    return {
      gameId: config.id, gameName: config.name,
      gameEmoji: config.emoji, winCondition: config.winCondition,
      players: players.map(p => ({ ...p, playerId: p.id })),
      phase: 'config',
      targetScore: 301,
      teams: [], currentTeamIndex: 0,
      history: [], undoStack: [],
      currentTurn: null,
    };
  }

  function renderSession(session, container, onEnd, onSave) {
    session.onEnd = onEnd; session.onSave = onSave || (() => {});
    if (!Array.isArray(session.undoStack)) session.undoStack = [];
    if (session.phase === 'config') renderConfig(session, container);
    else renderGame(session, container);
  }

  // ── CONFIG ───────────────────────────────────────────────────────────────
  function renderConfig(session, container) {
    const players = session.players;
    container.innerHTML = `<div class="dt3-wrap"><div class="dt3-config">
      <div class="dt3-config-title">🎯 Parchi</div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Score à atteindre</label>
        <div class="dt3-presets">
          <button class="dt3-preset active" data-val="301">301</button>
          <button class="dt3-preset" data-val="501">501</button>
          <button class="dt3-preset" data-val="701">701</button>
        </div>
        <div class="dt3-pick-hint">On part de 0. Si tu dépasses, tu recules de l'excédent. Si tu tombes sur le score d'un adversaire, il retombe à 0.</div>
      </div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Mode de jeu</label>
        <div class="dt3-presets">
          <button class="dt3-preset active" data-mode="solo">👤 Individuel</button>
          <button class="dt3-preset" data-mode="team">👥 Équipes</button>
        </div>
      </div>

      <div class="dt3-config-section" id="pchTeamSizeSection" style="display:none">
        <label class="dt3-cfg-label">Joueurs par équipe</label>
        <div class="dt3-presets">
          ${[2,3,4].map(n => `<button class="dt3-preset ${n===2?'active':''}" data-size="${n}">${n}</button>`).join('')}
        </div>
      </div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Ordre de jeu</label>
        <div class="dt3-pick-hint">Cliquez pour définir l'ordre</div>
        <div class="dt3-pick-grid" id="pchPickGrid"></div>
      </div>

      <button class="dt3-btn dt3-btn-start" id="pchStart" disabled>Lancer la partie →</button>
    </div></div>`;

    let targetScore = 301, teamMode = false, teamSize = 2;
    const order = [];

    const renderPick = () => {
      const grid = container.querySelector('#pchPickGrid');
      grid.innerHTML = players.map((p, i) => {
        const pos = order.indexOf(i);
        let badge = '';
        if (teamMode && pos !== -1) {
          const ti = Math.floor(pos / teamSize);
          badge = `<span class="dt3-pick-team" style="background:${teamColors[ti % teamColors.length]}">É${ti+1}</span>`;
        } else if (!teamMode && pos !== -1) {
          badge = `<span class="dt3-pick-order">${pos+1}</span>`;
        }
        return `<div class="dt3-pick-card ${pos !== -1 ? 'selected' : ''}" data-idx="${i}" style="--pc:${p.color}">
          <span class="dt3-pick-avatar">${p.avatar}</span>
          <span class="dt3-pick-name">${esc(p.name)}</span>
          ${badge}
        </div>`;
      }).join('');

      grid.querySelectorAll('.dt3-pick-card').forEach(card => {
        card.addEventListener('click', () => {
          const i = parseInt(card.dataset.idx, 10);
          const pos = order.indexOf(i);
          if (pos !== -1) order.splice(pos, 1); else if (order.length < players.length) order.push(i);
          renderPick(); checkStart();
        });
      });
    };

    const checkStart = () => {
      const valid = teamMode
        ? order.length >= teamSize * 2 && order.length % teamSize === 0
        : order.length === players.length;
      container.querySelector('#pchStart').disabled = !valid;
    };

    container.querySelectorAll('[data-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-val]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        targetScore = parseInt(btn.dataset.val, 10);
      });
    });
    container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        teamMode = btn.dataset.mode === 'team';
        container.querySelector('#pchTeamSizeSection').style.display = teamMode ? '' : 'none';
        container.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        order.length = 0; renderPick(); checkStart();
      });
    });
    container.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-size]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); teamSize = parseInt(btn.dataset.size, 10);
        order.length = 0; renderPick(); checkStart();
      });
    });

    container.querySelector('#pchStart').addEventListener('click', () => {
      session.targetScore = targetScore;

      const buildTeam = (indices, teamIdx) => ({
        id: teamMode ? 'team'+(teamIdx+1) : players[indices[0]].id,
        name: teamMode ? `Équipe ${teamIdx+1}` : players[indices[0]].name,
        color: teamMode ? teamColors[teamIdx % teamColors.length] : players[indices[0]].color,
        members: indices.map(i => ({ ...players[i], playerId: players[i].id })),
        currentMember: 0,
        score: 0,
        history: [],
        stats: {
          dartsThrown: 0, validDarts: 0, scoredPoints: 0,
          doublesHit: 0, triplesHit: 0,
          bounces: 0, knockouts: 0, timesKnocked: 0,
        },
      });

      session.teams = teamMode
        ? Array.from({ length: order.length / teamSize }, (_, t) => buildTeam(order.slice(t*teamSize, (t+1)*teamSize), t))
        : order.map((i, idx) => buildTeam([i], idx));

      session.currentTeamIndex = 0;
      session.history = [];
      session.undoStack = [];
      resetTurn(session);
      session.phase = 'playing';
      session.onSave();
      renderGame(session, container);
    });

    renderPick(); checkStart();
  }

  // ── JEU ──────────────────────────────────────────────────────────────────
  function renderGame(session, container) {
    if (!session.currentTurn) resetTurn(session);
    if (!session.currentTurn.selectedMult) session.currentTurn.selectedMult = 'single';

    container.innerHTML = `<div class="dt3-wrap">
      <div class="dt3-msgbar" id="pchMsgbar"></div>
      <div class="dt3-scores" id="pchScores"></div>
      <div class="dt3-board-section">
        <div class="dt3-turn-header">
          <div class="dt3-turn-label" id="pchTurnLabel"></div>
          <div class="dt3-darts-track" id="pchDartsTrack"></div>
        </div>
        <div class="dt3-shot-panel">
          <div class="dt3-mult-row">
            <button class="dt3-btn dt3-mult-btn" data-mult="double">Double</button>
            <button class="dt3-btn dt3-mult-btn" data-mult="triple">Triple</button>
            <button class="dt3-btn dt3-mult-btn" data-mult="bull25">Bull 25</button>
            <button class="dt3-btn dt3-mult-btn" data-mult="bull">Bull 50</button>
          </div>
          <div class="dt3-num-grid">
            ${Array.from({ length: 20 }, (_, i) => i + 1).map(n =>
              `<button class="dt3-btn dt3-num-btn" data-num="${n}">${n}</button>`
            ).join('')}
          </div>
        </div>
        <div class="dt3-board-actions">
          <button class="dt3-btn dt3-btn-miss" id="pchBtnMiss">Manqué</button>
          <button class="dt3-btn dt3-btn-validate" id="pchBtnValidate" ${session.currentTurn.darts.length ? '' : 'disabled'}>Valider le tour</button>
          <button class="dt3-btn dt3-btn-undo" id="pchBtnUndo" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
        </div>
      </div>
    </div>`;

    container.querySelectorAll('.dt3-mult-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mult = btn.dataset.mult;
        if (mult === 'bull' || mult === 'bull25') {
          onDartThrow(session, container, 'Bull', mult);
          return;
        }
        session.currentTurn.selectedMult = session.currentTurn.selectedMult === mult ? 'single' : mult;
        refreshMultiplierButtons(session, container);
      });
    });
    container.querySelectorAll('.dt3-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.num, 10);
        onDartThrow(session, container, n, session.currentTurn.selectedMult || 'single');
      });
    });
    container.querySelector('#pchBtnMiss').addEventListener('click', () => onDartThrow(session, container, null, 'miss'));
    container.querySelector('#pchBtnValidate').addEventListener('click', () => commitTurn(session, container));
    container.querySelector('#pchBtnUndo').addEventListener('click', () => undoThrow(session, container));

    refreshGame(session, container);
  }

  function resetTurn(session) {
    session.currentTurn = { darts: [], selectedMult: 'single' };
  }

  function onDartThrow(session, container, sector, ring) {
    const turn = session.currentTurn;
    if (session.phase === 'ended' || turn.darts.length >= 3) return;

    pushUndo(session);
    const team = session.teams[session.currentTeamIndex];
    const target = session.targetScore;
    const value = computeValue(sector, ring);
    const before = team.score;

    team.stats.dartsThrown++;
    if (value > 0) {
      team.stats.validDarts++;
      team.stats.scoredPoints += value;
      if (ring === 'double' || ring === 'bull') team.stats.doublesHit++;
      if (ring === 'triple') team.stats.triplesHit++;
    }

    let after = before + value;
    const bounced = after > target;
    if (bounced) {
      after = target - (after - target);
      team.stats.bounces++;
    }
    team.score = after;

    const knocked = [];
    const knockedIdx = [];
    if (value > 0 && after > 0 && after < target) {
      session.teams.forEach((t, i) => {
        if (t !== team && t.score === after) {
          t.score = 0;
          t.stats.timesKnocked++;
          team.stats.knockouts++;
          knocked.push(t.name);
          knockedIdx.push(i);
        }
      });
    }

    turn.darts.push({ sector, ring, value, before, after, bounced, knocked });
    turn.selectedMult = 'single';

    if (after === target) {
      finishTurn(session);
      session.onSave();
      refreshGame(session, container);
      showMsg(container, `🏆 ${team.name} atteint ${target} !`, 'info');
      setTimeout(() => endGame(session), 600);
      return;
    }

    if (turn.darts.length === 3) {
      commitTurn(session, container);
    } else {
      session.onSave();
      refreshGame(session, container);
    }

    if (knocked.length) {
      showMsg(container, `💥 ${team.name} renvoie ${knocked.join(', ')} à 0 !`, 'error');
      playKillAnimation(container, team, knockedIdx, session);
    } else if (bounced) {
      showMsg(container, `↩️ Dépassement de ${before + value - target} — retour à ${after}`, 'warning');
    }
  }

  const DART_VALUES = [...new Set([
    ...Array.from({ length: 20 }, (_, i) => [i + 1, (i + 1) * 2, (i + 1) * 3]).flat(), 25, 50,
  ])];

  // Scores reachable within `darts` darts (bounce included); a kill happens on any of them.
  function reachableScores(start, darts, target) {
    const reach = new Set();
    let frontier = new Set([start]);
    for (let d = 0; d < darts; d++) {
      const next = new Set();
      frontier.forEach(s => DART_VALUES.forEach(v => {
        let n = s + v;
        if (n > target) n = 2 * target - n;
        if (n !== target) next.add(n);
      }));
      next.forEach(n => reach.add(n));
      frontier = next;
    }
    return reach;
  }

  function playKillAnimation(container, killer, victimIdx, session) {
    victimIdx.forEach(i => {
      const card = container.querySelector(`.dt3-score-card[data-team="${i}"]`);
      if (!card) return;
      card.classList.remove('pch-killed');
      void card.offsetWidth;
      card.classList.add('pch-killed');
    });
    const overlay = document.createElement('div');
    overlay.className = 'pch-kill-overlay';
    overlay.innerHTML = `<div class="pch-kill-box" style="--pc:${killer.color}">
      <div class="pch-kill-title">💀 KILL !</div>
      <div class="pch-kill-sub">${esc(killer.name)} renvoie ${victimIdx.map(i => esc(session.teams[i].name)).join(', ')} à 0</div>
    </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1600);
  }

  function computeValue(sector, ring) {
    if (ring === 'miss') return 0;
    if (ring === 'bull25') return 25;
    if (ring === 'bull') return 50;
    const n = Number(sector) || 0;
    if (ring === 'double') return n * 2;
    if (ring === 'triple') return n * 3;
    return n;
  }

  function finishTurn(session) {
    const team = session.teams[session.currentTeamIndex];
    const darts = session.currentTurn.darts;
    const start = darts.length ? darts[0].before : team.score;
    const entry = { darts, start, end: team.score };
    session.history.push({ teamId: team.id, teamName: team.name, ...entry });
    team.history.push(entry);
  }

  function commitTurn(session, container) {
    if (session.phase === 'ended' || !session.currentTurn.darts.length) return;
    finishTurn(session);
    const team = session.teams[session.currentTeamIndex];
    team.currentMember = (team.currentMember + 1) % team.members.length;
    session.currentTeamIndex = (session.currentTeamIndex + 1) % session.teams.length;
    resetTurn(session);
    session.onSave();
    renderGame(session, container);
  }

  function pushUndo(session) {
    session.undoStack.push(JSON.parse(JSON.stringify({
      teams: session.teams,
      currentTeamIndex: session.currentTeamIndex,
      history: session.history,
      currentTurn: session.currentTurn,
    })));
  }

  function undoThrow(session, container) {
    if (session.phase === 'ended' || !session.undoStack.length) return;
    const prev = session.undoStack.pop();
    session.teams = prev.teams;
    session.currentTeamIndex = prev.currentTeamIndex;
    session.history = prev.history;
    session.currentTurn = prev.currentTurn || { darts: [], selectedMult: 'single' };
    session.onSave();
    renderGame(session, container);
  }

  // ── AFFICHAGE ────────────────────────────────────────────────────────────
  function refreshGame(session, container) {
    const team = session.teams[session.currentTeamIndex];
    const member = team.members[team.currentMember];
    const target = session.targetScore;
    const reachable = reachableScores(team.score, 3 - session.currentTurn.darts.length, target);

    container.querySelector('#pchScores').innerHTML = session.teams.map((t, i) => {
      const isActive = i === session.currentTeamIndex;
      const pct = Math.round((t.score / target) * 100);
      const membersHtml = t.members.length > 1
        ? `<div class="dt3-team-members">${t.members.map((m, mi) =>
            `<span class="dt3-member ${mi === t.currentMember && isActive ? 'active' : ''}">${m.avatar}</span>`
          ).join('')}</div>` : '';
      const st = t.stats;
      const avg = st.dartsThrown ? ((st.scoredPoints / st.dartsThrown) * 3).toFixed(1) : '0.0';
      const killable = !isActive && t.score > 0 && reachable.has(t.score);
      const diff = t.score - team.score;
      const killHtml = killable
        ? `<span class="pch-kill-hint">🎯 Kill ${diff > 0 ? '+' + diff : '−' + (-diff) + ' ↩️'}</span>`
        : '&nbsp;';
      return `<div class="dt3-score-card ${isActive ? 'active' : ''} ${killable ? 'pch-killable' : ''}" data-team="${i}" style="--pc:${t.color}">
        <div class="dt3-sc-head">
          <span class="dt3-sc-avatar">${t.members.length === 1 ? t.members[0].avatar : '👥'}</span>
          <div class="dt3-sc-info"><div class="dt3-sc-name">${esc(t.name)}</div>${membersHtml}</div>
          ${isActive ? '<span class="dt3-sc-turn-dot">●</span>' : ''}
        </div>
        <div class="dt3-sc-score">${t.score}</div>
        <div class="dt3-sc-bar"><div class="dt3-sc-fill" style="width:${pct}%"></div></div>
        <div class="dt3-sc-last">Reste ${target - t.score} · Moy.3 ${avg}</div>
        <div class="dt3-sc-last">${killHtml}</div>
      </div>`;
    }).join('');

    container.querySelector('#pchTurnLabel').innerHTML =
      `<strong style="color:${team.color}">${esc(member.name)}</strong> — ${team.score} / ${target}, reste <strong>${target - team.score}</strong>`;

    refreshDartsTrack(session, container);
    refreshMultiplierButtons(session, container);
    container.querySelector('#pchBtnUndo').disabled = !session.undoStack.length;
    container.querySelector('#pchBtnValidate').disabled = !session.currentTurn.darts.length;
  }

  function refreshDartsTrack(session, container) {
    const turn = session.currentTurn;
    const team = session.teams[session.currentTeamIndex];
    const slots = [0,1,2].map(i => {
      const d = turn.darts[i];
      if (!d) return `<div class="dt3-dart-slot empty"><span>🎯</span></div>`;
      const label = d.ring === 'miss' ? 'Manqué' :
        d.ring === 'bull' ? 'Bull 50' :
        d.ring === 'bull25' ? 'Bull 25' :
        d.ring === 'double' ? `D${d.sector}` :
        d.ring === 'triple' ? `T${d.sector}` :
        `${d.sector}`;
      const extra = d.knocked.length ? ' 💥' : d.bounced ? ' ↩️' : '';
      return `<div class="dt3-dart-slot filled" style="--pc:${team.color}">
        <span class="dt3-dart-label">${label}${extra}</span>
        <span class="dt3-dart-val">+${d.value}</span>
      </div>`;
    }).join('');

    const start = turn.darts.length ? turn.darts[0].before : team.score;
    container.querySelector('#pchDartsTrack').innerHTML = `
      <div class="dt3-darts-slots">${slots}</div>
      <div class="dt3-turn-total">
        Tour : ${start} → <strong style="color:${team.color}">${team.score}</strong>
      </div>`;
  }

  function refreshMultiplierButtons(session, container) {
    const active = session.currentTurn?.selectedMult || 'single';
    container.querySelectorAll('.dt3-mult-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mult === active);
    });
  }

  // ── FIN ──────────────────────────────────────────────────────────────────
  function endGame(session) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    const sorted = [...session.teams].sort((a, b) => b.score - a.score);
    session.onEnd({
      gameId: session.gameId, gameName: session.gameName,
      gameEmoji: session.gameEmoji, winCondition: 'highest',
      players: sorted.map(t => ({
        playerId: t.id,
        name: t.name,
        finalScore: t.score,
        stats: {
          dartsThrown: t.stats.dartsThrown,
          validDarts: t.stats.validDarts,
          averagePerDart: t.stats.dartsThrown ? Number((t.stats.scoredPoints / t.stats.dartsThrown).toFixed(2)) : 0,
          threeDartAverage: t.stats.dartsThrown ? Number(((t.stats.scoredPoints / t.stats.dartsThrown) * 3).toFixed(2)) : 0,
          doublesHit: t.stats.doublesHit,
          triplesHit: t.stats.triplesHit,
          bounces: t.stats.bounces,
          knockouts: t.stats.knockouts,
          timesKnocked: t.stats.timesKnocked,
        },
      })),
      rounds: session.history.length, duration: null,
    });
  }

  let _msgTimer;
  function showMsg(container, msg, type = 'info') {
    const bar = container.querySelector('#pchMsgbar');
    if (!bar) return;
    bar.textContent = msg;
    bar.className = `dt3-msgbar dt3-msgbar-show dt3-msg-${type}`;
    clearTimeout(_msgTimer);
    _msgTimer = setTimeout(() => bar.classList.remove('dt3-msgbar-show'), 3500);
  }

  return { createSession, renderSession };
})();
