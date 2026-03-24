/**
 * MODULE FLÉCHETTES 301/501/701
 * Interface : sélection multiplicateur + numéro, 3 fléchettes par tour
 */
window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['darts301'] = (() => {

  const teamColors = ['#f97316','#0ea5e9','#22c55e','#a855f7','#f43f5e','#fbbf24'];

  function createSession(config, players) {
    return {
      gameId: config.id, gameName: config.name,
      gameEmoji: config.emoji, winCondition: config.winCondition,
      players: players.map(p => ({ ...p, playerId: p.id })),
      phase: 'config',
      startScore: 501, doubleIn: false, doubleOut: false,
      teams: [], currentTeamIndex: 0,
      history: [], undoStack: [],
    };
  }

  function renderSession(session, container, onEnd, onSave) {
    session.onEnd = onEnd; session.onSave = onSave || (() => {});
    renderDispatch(session, container);
  }

  function renderDispatch(session, container) {
    if (session.phase === 'config') renderConfig(session, container);
    else renderGame(session, container);
  }

  // ── CONFIG ───────────────────────────────────────────────────────────────
  function renderConfig(session, container) {
    const players = session.players;
    container.innerHTML = `<div class="dt3-wrap"><div class="dt3-config">
      <div class="dt3-config-title">🎯 Fléchettes ${session.startScore}</div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Score de départ</label>
        <div class="dt3-presets">
          <button class="dt3-preset active" data-val="301">301</button>
          <button class="dt3-preset" data-val="501">501</button>
          <button class="dt3-preset" data-val="701">701</button>
        </div>
      </div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Règles doubles</label>
        <div class="dt3-toggles">
          <label class="dt3-toggle"><input type="checkbox" id="cfgDoubleIn"> <span>Double In</span> <em>commencer sur un double</em></label>
          <label class="dt3-toggle"><input type="checkbox" id="cfgDoubleOut"> <span>Double Out</span> <em>finir sur un double</em></label>
        </div>
      </div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Mode de jeu</label>
        <div class="dt3-presets">
          <button class="dt3-preset active" data-mode="solo" id="modeSolo">👤 Individuel</button>
          <button class="dt3-preset" data-mode="team" id="modeTeam">👥 Équipes</button>
        </div>
      </div>

      <div class="dt3-config-section" id="teamSizeSection" style="display:none">
        <label class="dt3-cfg-label">Joueurs par équipe</label>
        <div class="dt3-presets">
          ${[2,3,4].map(n => `<button class="dt3-preset ${n===2?'active':''}" data-size="${n}">${n}</button>`).join('')}
        </div>
      </div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label" id="playerPickLabel">Ordre de jeu</label>
        <div class="dt3-pick-hint" id="pickHint">Cliquez pour définir l'ordre</div>
        <div class="dt3-pick-grid" id="playerPickGrid"></div>
      </div>

      <button class="dt3-btn dt3-btn-start" id="cfgStart" disabled>Lancer la partie →</button>
    </div></div>`;

    let startScore = 301, teamMode = false, teamSize = 2;
    const order = [];

    const renderPick = () => {
      const grid = container.querySelector('#playerPickGrid');
      grid.innerHTML = players.map((p, i) => {
        const pos = order.indexOf(i);
        let badge = '';
        if (teamMode && pos !== -1) {
          const ti = Math.floor(pos / teamSize) + 1;
          badge = `<span class="dt3-pick-team" style="background:${teamColors[ti-1]}">É${ti}</span>`;
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
          const i = parseInt(card.dataset.idx);
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
      container.querySelector('#cfgStart').disabled = !valid;
    };

    container.querySelectorAll('[data-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-val]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        startScore = parseInt(btn.dataset.val);
      });
    });

    container.querySelector('#modeSolo').addEventListener('click', () => {
      teamMode = false; container.querySelector('#teamSizeSection').style.display = 'none';
      container.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      container.querySelector('#modeSolo').classList.add('active');
      order.length = 0; renderPick(); checkStart();
    });
    container.querySelector('#modeTeam').addEventListener('click', () => {
      teamMode = true; container.querySelector('#teamSizeSection').style.display = '';
      container.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      container.querySelector('#modeTeam').classList.add('active');
      order.length = 0; renderPick(); checkStart();
    });
    container.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-size]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); teamSize = parseInt(btn.dataset.size);
        order.length = 0; renderPick(); checkStart();
      });
    });

    container.querySelector('#cfgStart').addEventListener('click', () => {
      session.startScore = startScore;
      session.doubleIn  = container.querySelector('#cfgDoubleIn').checked;
      session.doubleOut = container.querySelector('#cfgDoubleOut').checked;

      const buildTeam = (indices, teamIdx) => {
        const members = indices.map(i => ({ ...players[i], playerId: players[i].id }));
        return {
          id: teamMode ? 'team'+(teamIdx+1) : (players[indices[0]].id),
          name: teamMode ? `Équipe ${teamIdx+1}` : players[indices[0]].name,
          color: teamMode ? teamColors[teamIdx] : players[indices[0]].color,
          avatar: !teamMode ? players[indices[0]].avatar : null,
          members, currentMember: 0,
          score: startScore,
          doubleInDone: !session.doubleIn,
          history: [],
          stats: {
            dartsThrown: 0,
            validDarts: 0,
            scoredPoints: 0,
            doublesHit: 0,
            triplesHit: 0,
            busts: 0,
            checkoutAttempts: 0,
            checkoutSuccess: 0,
          },
        };
      };

      if (teamMode) {
        const nb = order.length / teamSize;
        session.teams = Array.from({length: nb}, (_, t) =>
          buildTeam(order.slice(t*teamSize, (t+1)*teamSize), t)
        );
      } else {
        session.teams = order.map((i, idx) => buildTeam([i], idx));
      }

      session.currentTeamIndex = 0;
      session.phase = 'playing';
      session.onSave();
      renderGame(session, container);
    });

    renderPick(); checkStart();
  }

  // ── JEU ──────────────────────────────────────────────────────────────────
  function renderGame(session, container) {
    // État du tour en cours
    if (!session.currentTurn) resetTurn(session);
    if (!Array.isArray(session.undoStack)) session.undoStack = [];
    if (!session.currentTurn.selectedMult) session.currentTurn.selectedMult = 'single';

    container.innerHTML = `<div class="dt3-wrap">
      <div class="dt3-msgbar" id="dt3Msgbar"></div>
      <div class="dt3-scores" id="dt3Scores"></div>
      <div class="dt3-board-section">
        <div class="dt3-turn-header">
          <div class="dt3-turn-label" id="dt3TurnLabel"></div>
          <div class="dt3-darts-track" id="dt3DartsTrack"></div>
        </div>
        <div class="dt3-shot-panel" id="dt3ShotPanel">
          <div class="dt3-mult-row">
            <button class="dt3-btn dt3-mult-btn" data-mult="single">Simple</button>
            <button class="dt3-btn dt3-mult-btn" data-mult="double">Double</button>
            <button class="dt3-btn dt3-mult-btn" data-mult="triple">Triple</button>
            <button class="dt3-btn dt3-mult-btn" data-mult="bull25">Bull 25</button>
            <button class="dt3-btn dt3-mult-btn" data-mult="bull">Bull 50</button>
          </div>
          <div class="dt3-num-grid" id="dt3NumGrid">
            ${Array.from({ length: 20 }, (_, i) => i + 1).map(n =>
              `<button class="dt3-btn dt3-num-btn" data-num="${n}">${n}</button>`
            ).join('')}
          </div>
        </div>
        <div class="dt3-board-actions">
          <button class="dt3-btn dt3-btn-miss" id="dt3BtnMiss">Manqué</button>
          <button class="dt3-btn dt3-btn-validate" id="dt3BtnValidate" disabled>Valider le tour</button>
          <button class="dt3-btn dt3-btn-undo" id="dt3BtnUndo" ${session.undoStack.length ? '' : 'disabled'}>↩ Annuler</button>
        </div>
      </div>
    </div>`;

    bindGameActions(session, container);
    refreshGame(session, container);
  }

  function resetTurn(session) {
    session.currentTurn = { darts: [], totalThisTurn: 0, selectedMult: 'single' };
  }

  function bindGameActions(session, container) {
    container.querySelectorAll('.dt3-mult-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mult = btn.dataset.mult;
        if (mult === 'bull' || mult === 'bull25') {
          onDartThrow(session, container, 'Bull', mult);
          return;
        }
        session.currentTurn.selectedMult = mult;
        refreshMultiplierButtons(session, container);
      });
    });
    container.querySelectorAll('.dt3-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.num, 10);
        const mult = session.currentTurn.selectedMult || 'single';
        onDartThrow(session, container, n, mult);
      });
    });
    container.querySelector('#dt3BtnMiss').addEventListener('click', () => {
      onDartThrow(session, container, null, 'miss');
    });
    container.querySelector('#dt3BtnValidate').addEventListener('click', () => {
      commitTurn(session, container);
    });
    container.querySelector('#dt3BtnUndo').addEventListener('click', () => {
      undoThrow(session, container);
    });
  }

  function onDartThrow(session, container, sector, ring) {
    const turn = session.currentTurn;
    if (turn.darts.length >= 3) return;

    const team = session.teams[session.currentTeamIndex];
    const value = computeValue(sector, ring);
    const ringLabel = ring;
    pushUndo(session);
    team.stats.dartsThrown++;

    // Double In check
    if (!team.doubleInDone) {
      if (ring !== 'double' && ring !== 'bull') {
        showMsg(container, `Double In requis ! Cette fléchette ne compte pas.`, 'warning');
        turn.darts.push({ sector, ring, value: 0, doubleInMiss: true });
        refreshDartsTrack(session, container);
        refreshUndoButton(session, container);
        if (turn.darts.length === 3) commitTurn(session, container);
        return;
      }
      team.doubleInDone = true;
      showMsg(container, `✅ ${team.name} entre dans la partie !`, 'info');
    }

    turn.darts.push({ sector, ring, value });
    turn.totalThisTurn += value;
    session.currentTurn.selectedMult = 'single';
    if (value > 0) {
      team.stats.validDarts++;
      if (ringLabel === 'double' || ringLabel === 'bull') team.stats.doublesHit++;
      if (ringLabel === 'triple') team.stats.triplesHit++;
    }

    refreshDartsTrack(session, container);
    refreshUndoButton(session, container);

    const btnValidate = container.querySelector('#dt3BtnValidate');
    btnValidate.disabled = false;

    // Preview bust
    const newScore = team.score - turn.totalThisTurn;
    if (newScore < 0 || (session.doubleOut && newScore === 1)) {
      showMsg(container, `⚠️ Bust si tu valides ! Score actuel : ${team.score}`, 'warning');
    } else if (newScore === 0) {
      showMsg(container, `🏆 Checkout ! Valide pour gagner.`, 'info');
    }

    if (turn.darts.length === 3) {
      commitTurn(session, container);
    }
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

  function refreshDartsTrack(session, container) {
    const turn = session.currentTurn;
    const track = container.querySelector('#dt3DartsTrack');
    const team = session.teams[session.currentTeamIndex];
    if (!track) return;

    const slots = [0,1,2].map(i => {
      const d = turn.darts[i];
      if (!d) return `<div class="dt3-dart-slot empty"><span>🎯</span></div>`;
      const label = d.ring === 'miss' ? 'Manqué' :
        d.ring === 'bull' ? 'Bull 50' :
        d.ring === 'bull25' ? 'Bull 25' :
        d.ring === 'double' ? `D${d.sector}` :
        d.ring === 'triple' ? `T${d.sector}` :
        `${d.sector}`;
      return `<div class="dt3-dart-slot filled" style="--pc:${team.color}">
        <span class="dt3-dart-label">${label}</span>
        <span class="dt3-dart-val">${d.doubleInMiss ? '—' : '+'+d.value}</span>
      </div>`;
    }).join('');

    const total = turn.totalThisTurn;
    const remain = team.score - total;
    track.innerHTML = `
      <div class="dt3-darts-slots">${slots}</div>
      <div class="dt3-turn-total">
        Tour : <strong>−${total}</strong> → reste <strong style="color:${remain < 0 ? 'var(--red)' : team.color}">${Math.max(0, remain)}</strong>
      </div>`;
  }

  function commitTurn(session, container) {
    const turn = session.currentTurn;
    if (!turn.darts.length) return;
    const team = session.teams[session.currentTeamIndex];
    const total = turn.totalThisTurn;
    const newScore = team.score - total;

    // Bust
    if (newScore < 0 || (session.doubleOut && newScore === 1)) {
      showMsg(container, `💥 BUST ! ${team.name} — score inchangé (${team.score})`, 'error');
      team.stats.busts++;
      session.history.push({ teamId: team.id, teamName: team.name, darts: turn.darts, total: 0, bust: true, remaining: team.score });
      team.history.push({ darts: turn.darts, total: 0, bust: true });
      resetTurn(session);
      nextTurn(session);
      session.onSave();
      renderGame(session, container);
      return;
    }

    // Check Double Out
    if (session.doubleOut && newScore === 0) {
      team.stats.checkoutAttempts++;
      const last = turn.darts[turn.darts.length - 1];
      if (last && last.ring !== 'double' && last.ring !== 'bull') {
        showMsg(container, `💥 BUST ! Faut finir sur un double.`, 'error');
        team.stats.busts++;
        session.history.push({ teamId: team.id, teamName: team.name, darts: turn.darts, total: 0, bust: true, remaining: team.score });
        team.history.push({ darts: turn.darts, total: 0, bust: true });
        resetTurn(session);
        nextTurn(session);
        session.onSave();
        renderGame(session, container);
        return;
      }
      team.stats.checkoutSuccess++;
    }

    team.score = newScore;
    team.stats.scoredPoints += total;
    session.history.push({ teamId: team.id, teamName: team.name, darts: turn.darts, total, bust: false, remaining: newScore });
    team.history.push({ darts: turn.darts, total, bust: false });

    if (newScore === 0) {
      session.onSave();
      renderGame(session, container);
      setTimeout(() => endGame(session, container), 600);
      return;
    }

    resetTurn(session);
    nextTurn(session);
    session.onSave();
    renderGame(session, container);
  }

  function undoThrow(session, container) {
    if (!session.undoStack?.length) return;
    const prev = session.undoStack.pop();
    restoreSnapshot(session, prev);
    session.onSave();
    renderGame(session, container);
  }

  function pushUndo(session) {
    if (!Array.isArray(session.undoStack)) session.undoStack = [];
    session.undoStack.push({
      teams: JSON.parse(JSON.stringify(session.teams)),
      currentTeamIndex: session.currentTeamIndex,
      history: JSON.parse(JSON.stringify(session.history)),
      currentTurn: JSON.parse(JSON.stringify(session.currentTurn || { darts: [], totalThisTurn: 0, selectedMult: 'single' })),
    });
  }

  function restoreSnapshot(session, snap) {
    session.teams = snap.teams;
    session.currentTeamIndex = snap.currentTeamIndex;
    session.history = snap.history;
    session.currentTurn = snap.currentTurn || { darts: [], totalThisTurn: 0, selectedMult: 'single' };
  }

  function refreshUndoButton(session, container) {
    const btn = container.querySelector('#dt3BtnUndo');
    if (btn) btn.disabled = !session.undoStack?.length;
  }

  function refreshMultiplierButtons(session, container) {
    const active = session.currentTurn?.selectedMult || 'single';
    container.querySelectorAll('.dt3-mult-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mult === active);
    });
    const disableNumbers = active === 'bull' || active === 'bull25' || active === 'miss';
    container.querySelectorAll('.dt3-num-btn').forEach(btn => {
      btn.disabled = disableNumbers;
    });
  }

  function nextTurn(session) {
    const team = session.teams[session.currentTeamIndex];
    team.currentMember = (team.currentMember + 1) % team.members.length;
    session.currentTeamIndex = (session.currentTeamIndex + 1) % session.teams.length;
  }

  function refreshGame(session, container) {
    const team = session.teams[session.currentTeamIndex];
    const member = team.members[team.currentMember];

    // Scores
    const scoresEl = container.querySelector('#dt3Scores');
    scoresEl.innerHTML = session.teams.map((t, i) => {
      const isActive = i === session.currentTeamIndex;
      const pct = Math.round((t.score / session.startScore) * 100);
      const membersHtml = t.members.length > 1
        ? `<div class="dt3-team-members">${t.members.map((m, mi) =>
            `<span class="dt3-member ${mi === t.currentMember && isActive ? 'active' : ''}">${m.avatar}</span>`
          ).join('')}</div>` : '';
      const last = t.history[t.history.length-1];
      const lastStr = last ? (last.bust ? '💥 Bust' : `−${last.total}`) : '';
      const st = t.stats || {};
      const valid = st.validDarts || 0;
      const thrown = st.dartsThrown || 0;
      const avg = thrown ? (st.scoredPoints / thrown).toFixed(2) : '0.00';
      return `<div class="dt3-score-card ${isActive ? 'active' : ''}" style="--pc:${t.color}">
        <div class="dt3-sc-head">
          <span class="dt3-sc-avatar">${t.members.length === 1 ? t.members[0].avatar : '👥'}</span>
          <div class="dt3-sc-info"><div class="dt3-sc-name">${esc(t.name)}</div>${membersHtml}</div>
          ${isActive ? '<span class="dt3-sc-turn-dot">●</span>' : ''}
        </div>
        <div class="dt3-sc-score">${t.score}</div>
        <div class="dt3-sc-bar"><div class="dt3-sc-fill" style="width:${pct}%"></div></div>
        <div class="dt3-sc-last">Darts valides: ${valid}/${thrown} · Moy: ${avg}</div>
        <div class="dt3-sc-last">${lastStr}</div>
      </div>`;
    }).join('');

    // Turn label
    const label = container.querySelector('#dt3TurnLabel');
    if (label) label.innerHTML = `<strong style="color:${team.color}">${esc(member.name)}</strong> — reste <strong>${team.score}</strong>`;

    refreshDartsTrack(session, container);
    refreshMultiplierButtons(session, container);
    refreshUndoButton(session, container);
  }

  function endGame(session, container) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    const sorted = [...session.teams].sort((a,b) => a.score - b.score);
    session.onEnd({
      gameId: session.gameId, gameName: session.gameName,
      gameEmoji: session.gameEmoji, winCondition: 'lowest',
      players: sorted.map(t => ({
        playerId: t.id,
        name: t.name,
        finalScore: t.score,
        stats: {
          dartsThrown: t.stats?.dartsThrown || 0,
          validDarts: t.stats?.validDarts || 0,
          averagePerDart: (t.stats?.dartsThrown || 0) ? Number(((t.stats.scoredPoints || 0) / t.stats.dartsThrown).toFixed(2)) : 0,
          threeDartAverage: (t.stats?.dartsThrown || 0) ? Number((((t.stats.scoredPoints || 0) / t.stats.dartsThrown) * 3).toFixed(2)) : 0,
          doublesHit: t.stats?.doublesHit || 0,
          triplesHit: t.stats?.triplesHit || 0,
          busts: t.stats?.busts || 0,
          checkoutAttempts: t.stats?.checkoutAttempts || 0,
          checkoutSuccess: t.stats?.checkoutSuccess || 0,
        },
      })),
      rounds: session.history.length, duration: null,
    });
  }

  let _msgTimer;
  function showMsg(container, msg, type='info') {
    const bar = container.querySelector('#dt3Msgbar');
    if (!bar) return;
    bar.textContent = msg;
    bar.className = `dt3-msgbar dt3-msgbar-show dt3-msg-${type}`;
    clearTimeout(_msgTimer);
    _msgTimer = setTimeout(() => bar.classList.remove('dt3-msgbar-show'), 3500);
  }

  return { createSession, renderSession };
})();
