/**
 * MODULE FLÉCHETTES CRICKET
 * Interface : dartboard SVG — 3 fléchettes par tour, seules les cibles actives sont cliquables
 */
window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES['dartscricket'] = (() => {

  const CLASSIC_TARGETS = [20,19,18,17,16,15,'Bull'];
  const teamColors = ['#f97316','#0ea5e9','#22c55e','#a855f7','#f43f5e','#fbbf24'];

  function createSession(config, players) {
    return {
      gameId: config.id, gameName: config.name,
      gameEmoji: config.emoji, winCondition: config.winCondition,
      players: players.map(p => ({ ...p, playerId: p.id })),
      phase: 'config',
      variant: 'classic', targets: [],
      teams: [], currentTeamIndex: 0,
      history: [], previousState: null,
    };
  }

  function renderSession(session, container, onEnd, onSave) {
    session.onEnd = onEnd; session.onSave = onSave || (() => {});
    if (!window.DartBoard) {
      loadScript('js/games/dartboard.js').then(() => renderDispatch(session, container));
    } else {
      renderDispatch(session, container);
    }
  }

  function renderDispatch(session, container) {
    if (session.phase === 'config') renderConfig(session, container);
    else renderGame(session, container);
  }

  // ── CONFIG ───────────────────────────────────────────────────────────────
  function renderConfig(session, container) {
    const players = session.players;
    container.innerHTML = `<div class="dc-wrap"><div class="dt3-config">
      <div class="dt3-config-title">🏹 Configuration Cricket</div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label">Variante</label>
        <div class="dc-variants">
          <button class="dc-variant active" data-variant="classic">
            <div class="dc-variant-name">Cricket classique</div>
            <div class="dc-variant-desc">Cibles 15–20 + Bull. Fermer et marquer sur les cibles adverses.</div>
          </button>
          <button class="dc-variant" data-variant="cutthroat">
            <div class="dc-variant-name">Cut Throat</div>
            <div class="dc-variant-desc">Marquer ajoute des points aux adversaires. Le moins de points gagne.</div>
          </button>
          <button class="dc-variant" data-variant="random">
            <div class="dc-variant-name">Cricket aléatoire</div>
            <div class="dc-variant-desc">7 cibles tirées au hasard parmi 1–20 + Bull.</div>
          </button>
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
          ${[2,3,4].map(n => `<button class="dt3-preset ${n===2?'active':''}" data-size="${n}">${n}</button>`).join('')}
        </div>
      </div>

      <div class="dt3-config-section">
        <label class="dt3-cfg-label" id="dcPickLabel">Ordre de jeu</label>
        <div class="dt3-pick-hint" id="dcPickHint">Cliquez pour définir l'ordre</div>
        <div class="dt3-pick-grid" id="dcPickGrid"></div>
      </div>

      <button class="dt3-btn dt3-btn-start" id="dcStart" disabled>Lancer la partie →</button>
    </div></div>`;

    let variant = 'classic', teamMode = false, teamSize = 2;
    const order = [];

    container.querySelectorAll('.dc-variant').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.dc-variant').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); variant = btn.dataset.variant;
      });
    });

    const renderPick = () => {
      const grid = container.querySelector('#dcPickGrid');
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
          <span class="dt3-pick-name">${esc(p.name)}</span>${badge}
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
        ? order.length >= teamSize*2 && order.length % teamSize === 0
        : order.length === players.length;
      container.querySelector('#dcStart').disabled = !valid;
    };

    container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        teamMode = btn.dataset.mode === 'team';
        container.querySelector('#dcTeamSizeSection').style.display = teamMode ? '' : 'none';
        container.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        order.length = 0; renderPick(); checkStart();
      });
    });

    container.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-size]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); teamSize = parseInt(btn.dataset.size);
        order.length = 0; renderPick(); checkStart();
      });
    });

    container.querySelector('#dcStart').addEventListener('click', () => {
      session.variant = variant;
      if (variant === 'random') {
        const pool = Array.from({length:20}, (_,i)=>i+1);
        const picked = [];
        while (picked.length < 6) { const i = Math.floor(Math.random()*pool.length); picked.push(pool.splice(i,1)[0]); }
        session.targets = [...picked.sort((a,b)=>b-a), 'Bull'];
      } else {
        session.targets = [...CLASSIC_TARGETS];
      }

      const buildTeam = (indices, ti) => {
        const members = indices.map(i => ({...players[i], playerId: players[i].id}));
        return {
          id: teamMode ? 'team'+(ti+1) : players[indices[0]].id,
          name: teamMode ? `Équipe ${ti+1}` : players[indices[0]].name,
          color: teamMode ? teamColors[ti] : players[indices[0]].color,
          members, currentMember: 0,
          marks: Object.fromEntries(session.targets.map(t=>[String(t),0])),
          points: 0, history: [],
        };
      };

      if (teamMode) {
        session.teams = Array.from({length: order.length/teamSize}, (_,t) =>
          buildTeam(order.slice(t*teamSize, (t+1)*teamSize), t)
        );
      } else {
        session.teams = order.map((i,idx) => buildTeam([i], idx));
      }

      session.currentTeamIndex = 0;
      if (!session.currentTurn) session.currentTurn = { darts: [] };
      session.phase = 'playing';
      session.onSave();
      renderGame(session, container);
    });

    renderPick(); checkStart();
  }

  // ── JEU ──────────────────────────────────────────────────────────────────
  function renderGame(session, container) {
    if (!session.currentTurn) session.currentTurn = { darts: [] };
    const team = session.teams[session.currentTeamIndex];

    // Cibles actives = cibles de la partie non fermées par tout le monde
    const activeSectors = new Set();
    session.targets.forEach(t => {
      const ts = String(t);
      const allClosed = session.teams.every(te => te.marks[ts] >= 3);
      if (!allClosed) activeSectors.add(t === 'Bull' ? 'Bull' : t);
    });
    // Ajouter aussi les cibles fermées par ce joueur mais pas tous (pour marquer des points)
    session.targets.forEach(t => {
      const ts = String(t);
      if ((team.marks[ts] || 0) >= 3) {
        const othersClosed = session.teams.every((te,i) => i === session.currentTeamIndex || te.marks[ts] >= 3);
        if (!othersClosed) activeSectors.add(t === 'Bull' ? 'Bull' : t);
      }
    });

    container.innerHTML = `<div class="dc-wrap">
      <div class="dt3-msgbar" id="dcMsgbar"></div>
      <div class="dc-variant-badge">${variantLabel(session.variant)}</div>
      <div class="dc-scores-row" id="dcScoresRow"></div>
      <div class="dt3-board-section">
        <div class="dt3-turn-header">
          <div class="dt3-turn-label" id="dcTurnLabel"></div>
          <div class="dt3-darts-track" id="dcDartsTrack"></div>
        </div>
        <div class="dt3-board-wrap" id="dcBoardWrap"></div>
        <div class="dt3-board-actions">
          <button class="dt3-btn dt3-btn-miss" id="dcBtnMiss">Manqué</button>
          <button class="dt3-btn dt3-btn-undo" id="dcBtnUndo" disabled>↩ Annuler</button>
        </div>
      </div>
      <div class="dc-grid-wrap"><div class="dc-grid" id="dcGrid"></div></div>
    </div>`;

    const boardWrap = container.querySelector('#dcBoardWrap');
    const svg = DartBoard.create(
      (sector, ring, value) => onDartCricket(session, container, sector, ring),
      { activeSectors, highlightColor: team.color }
    );
    boardWrap.appendChild(svg);

    container.querySelector('#dcBtnMiss').addEventListener('click', () => {
      onDartCricket(session, container, null, 'miss');
    });
    container.querySelector('#dcBtnUndo').addEventListener('click', () => {
      undoThrow(session, container);
    });

    refreshCricketUI(session, container);
  }

  function onDartCricket(session, container, sector, ring) {
    const turn = session.currentTurn;
    if (turn.darts.length >= 3) return;

    const team = session.teams[session.currentTeamIndex];
    const isCT = session.variant === 'cutthroat';

    let touches = 0;
    let targetStr = null;

    if (ring === 'miss' || sector === null) {
      // Manqué
      turn.darts.push({ sector: null, ring: 'miss', touches: 0, targetStr: null });
    } else {
      // Nombre de touches selon la zone
      touches = ring === 'triple' ? 3 : ring === 'double' ? 2 : (ring === 'bull' ? 2 : 1);
      // bull 25 = 1 touche, bull 50 = 2 touches
      if (ring === 'bull25') touches = 1;
      if (ring === 'bull') touches = 2;

      // La cible touchée dans le contexte Cricket
      if (sector === 'Bull' || ring === 'bull' || ring === 'bull25') {
        targetStr = 'Bull';
      } else {
        // Vérifier si ce secteur est une cible du jeu
        const isTarget = session.targets.some(t => String(t) === String(sector));
        if (!isTarget) {
          // Zone hors cible — compte comme manqué
          turn.darts.push({ sector, ring, touches: 0, targetStr: null, offTarget: true });
          showMsg(container, `${sector} n'est pas une cible — fléchette hors jeu.`, 'warning');
          refreshDartsTrackCricket(session, container);
          if (turn.darts.length === 3) commitCricketTurn(session, container);
          return;
        }
        targetStr = String(sector);
      }

      // Appliquer les touches (logique différée au commit pour l'undo)
      turn.darts.push({ sector, ring, touches, targetStr });
    }

    container.querySelector('#dcBtnUndo').disabled = false;
    refreshDartsTrackCricket(session, container);

    if (turn.darts.length === 3) {
      commitCricketTurn(session, container);
    }
  }

  function refreshDartsTrackCricket(session, container) {
    const turn = session.currentTurn;
    const team = session.teams[session.currentTeamIndex];
    const track = container.querySelector('#dcDartsTrack');
    if (!track) return;

    const slots = [0,1,2].map(i => {
      const d = turn.darts[i];
      if (!d) return `<div class="dt3-dart-slot empty"><span>🎯</span></div>`;
      let label, sub;
      if (d.ring === 'miss') { label = 'Manqué'; sub = '—'; }
      else if (d.offTarget) { label = `${d.sector}`; sub = 'Hors cible'; }
      else {
        label = d.targetStr === 'Bull' ? 'Bull' : `${d.sector}`;
        sub = `×${d.touches}`;
        if (d.ring === 'double') label = `D${d.sector}`;
        if (d.ring === 'triple') label = `T${d.sector}`;
        if (d.ring === 'bull') label = 'BULL';
        if (d.ring === 'bull25') label = 'Bull 25';
      }
      return `<div class="dt3-dart-slot filled" style="--pc:${team.color}">
        <span class="dt3-dart-label">${label}</span>
        <span class="dt3-dart-val">${sub}</span>
      </div>`;
    }).join('');

    track.innerHTML = `<div class="dt3-darts-slots">${slots}</div>`;
  }

  function commitCricketTurn(session, container) {
    saveState(session);
    const turn = session.currentTurn;
    const team = session.teams[session.currentTeamIndex];
    const isCT = session.variant === 'cutthroat';
    const CLOSED = 3;

    // Appliquer toutes les touches
    turn.darts.forEach(d => {
      if (!d.targetStr || d.touches === 0) return;
      const ts = d.targetStr;

      // Vérifier si la cible est fermée par tout le monde → ignorée
      const allClosed = session.teams.every(t => (t.marks[ts]||0) >= 3);
      if (allClosed) return;

      const prevMarks = team.marks[ts] || 0;
      const newMarks = prevMarks + d.touches;
      team.marks[ts] = newMarks;

      // Touches bonus (au-delà de 3)
      if (prevMarks < CLOSED) {
        const bonus = Math.max(0, newMarks - CLOSED);
        if (bonus > 0) applyPoints(session, team, ts, bonus, isCT);
      } else {
        // Déjà fermé par ce joueur → bonus direct
        applyPoints(session, team, ts, d.touches, isCT);
      }
    });

    session.history.push({ teamId: team.id, teamName: team.name, darts: turn.darts });
    team.history.push({ darts: turn.darts });

    // Passer au joueur suivant
    team.currentMember = (team.currentMember + 1) % team.members.length;
    session.currentTeamIndex = (session.currentTeamIndex + 1) % session.teams.length;
    session.currentTurn = { darts: [] };

    session.onSave();

    if (checkWin(session)) {
      renderGame(session, container);
      setTimeout(() => endGame(session, container), 500);
      return;
    }

    renderGame(session, container);
  }

  function applyPoints(session, team, targetStr, bonus, isCT) {
    const val = targetStr === 'Bull' ? 25 : parseInt(targetStr);
    const pts = bonus * val;
    if (isCT) {
      session.teams.forEach((t, i) => {
        if (t.id !== team.id && (t.marks[targetStr]||0) < 3) t.points += pts;
      });
    } else {
      const opponentsClosed = session.teams.every(t =>
        t.id === team.id || (t.marks[targetStr]||0) >= 3
      );
      if (!opponentsClosed) team.points += pts;
    }
  }

  function checkWin(session) {
    const isCT = session.variant === 'cutthroat';
    const allClosed = session.targets.every(t => {
      const ts = String(t);
      return session.teams.some(te => te.marks[ts] >= 3);
    });
    if (!allClosed) return false;
    if (isCT) {
      const min = Math.min(...session.teams.map(t=>t.points));
      return session.teams.some(t=>t.points===min);
    } else {
      return session.teams.some(t => {
        const closed = session.targets.every(ta => t.marks[String(ta)] >= 3);
        if (!closed) return false;
        return t.points >= Math.max(...session.teams.map(x=>x.points));
      });
    }
  }

  function refreshCricketUI(session, container) {
    const team = session.teams[session.currentTeamIndex];
    const member = team.members[team.currentMember];

    // Turn label
    const label = container.querySelector('#dcTurnLabel');
    if (label) label.innerHTML = `<strong style="color:${team.color}">${esc(member.name)}</strong> — sélectionne une cible`;

    refreshDartsTrackCricket(session, container);
    renderCricketScores(session, container);
    renderCricketGrid(session, container);
  }

  function renderCricketScores(session, container) {
    const el = container.querySelector('#dcScoresRow');
    if (!el) return;
    el.innerHTML = session.teams.map((t, i) => {
      const isActive = i === session.currentTeamIndex;
      return `<div class="dc-score-chip ${isActive ? 'active' : ''}" style="--pc:${t.color}">
        <span>${t.members.length > 1 ? '👥' : t.members[0].avatar}</span>
        <span class="dc-chip-name">${esc(t.name)}</span>
        <span class="dc-chip-pts">${t.points} pts</span>
        ${isActive ? '<span class="dt3-sc-turn-dot">●</span>' : ''}
      </div>`;
    }).join('');
  }

  function renderCricketGrid(session, container) {
    const grid = container.querySelector('#dcGrid');
    if (!grid) return;
    const isCT = session.variant === 'cutthroat';

    let html = `<div class="dc-grid-header">
      <div class="dc-gh-target">Cible</div>
      ${session.teams.map(t => `<div class="dc-gh-team" style="--pc:${t.color}">
        <span>${t.members.length > 1 ? '👥' : t.members[0].avatar}</span>
        <span>${esc(t.name)}</span>
      </div>`).join('')}
    </div>`;

    html += session.targets.map(target => {
      const ts = String(target);
      const allClosed = session.teams.every(t => t.marks[ts] >= 3);
      const cells = session.teams.map(t => {
        const m = t.marks[ts] || 0;
        const icon = m === 0 ? '' : m === 1 ? '<span class="dc-mark1">/</span>'
          : m === 2 ? '<span class="dc-mark2">✗</span>'
          : '<span class="dc-mark3">✗</span>';
        return `<div class="dc-cell ${m >= 3 ? 'closed' : ''}" style="--pc:${t.color}">${icon}</div>`;
      }).join('');
      return `<div class="dc-row ${allClosed ? 'all-closed' : ''}">
        <div class="dc-row-target ${allClosed ? 'target-done' : ''}">${target === 'Bull' ? '🎯' : target}</div>
        ${cells}
      </div>`;
    }).join('');

    html += `<div class="dc-row dc-score-row">
      <div class="dc-row-target"><strong>${isCT ? '⚠️ Points' : 'Points'}</strong></div>
      ${session.teams.map(t => `<div class="dc-cell dc-score-cell" style="--pc:${t.color}"><strong>${t.points}</strong></div>`).join('')}
    </div>`;

    grid.innerHTML = html;
  }

  function saveState(session) {
    session.previousState = {
      teams: JSON.parse(JSON.stringify(session.teams)),
      currentTeamIndex: session.currentTeamIndex,
      history: JSON.parse(JSON.stringify(session.history)),
    };
  }

  function undoThrow(session, container) {
    const turn = session.currentTurn;
    if (turn.darts.length > 0) {
      turn.darts.pop();
      container.querySelector('#dcBtnUndo').disabled = turn.darts.length === 0;
      session.onSave();
      refreshCricketUI(session, container);
      refreshDartsTrackCricket(session, container);
    } else if (session.previousState) {
      session.teams = session.previousState.teams;
      session.currentTeamIndex = session.previousState.currentTeamIndex;
      session.history = session.previousState.history;
      session.previousState = null;
      session.currentTurn = { darts: [] };
      session.onSave();
      renderGame(session, container);
      showMsg(container, 'Tour annulé.', 'info');
    }
  }

  function endGame(session, container) {
    if (session.phase === 'ended') return;
    session.phase = 'ended';
    const isCT = session.variant === 'cutthroat';
    const sorted = [...session.teams].sort((a,b) => isCT ? a.points-b.points : b.points-a.points);
    session.onEnd({
      gameId: session.gameId, gameName: session.gameName,
      gameEmoji: session.gameEmoji, winCondition: isCT ? 'lowest' : 'highest',
      players: sorted.map(t => ({ playerId: t.id, name: t.name, finalScore: t.points })),
      rounds: session.history.length, duration: null,
    });
  }

  function variantLabel(v) {
    return { classic:'🎯 Cricket classique', cutthroat:'⚔️ Cut Throat', random:'🎲 Cricket aléatoire' }[v] || '';
  }

  let _msgTimer;
  function showMsg(container, msg, type='info') {
    const bar = container.querySelector('#dcMsgbar');
    if (!bar) return;
    bar.textContent = msg;
    bar.className = `dt3-msgbar dt3-msgbar-show dt3-msg-${type}`;
    clearTimeout(_msgTimer);
    _msgTimer = setTimeout(() => bar.classList.remove('dt3-msgbar-show'), 3500);
  }

  return { createSession, renderSession };
})();
