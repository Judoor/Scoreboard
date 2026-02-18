/**
 * MODULE DUTCH
 * ─────────────────────────────────────────────────────────────────────────────
 * Règles :
 *  - Jeu de cartes, chaque joueur reçoit 4 cartes
 *  - Objectif : avoir le moins de points possible
 *  - Valeur des cartes : As=1, 2–10=valeur, Valet=11, Dame=12, Roi=13
 *  - Cartes spéciales : 9 (voir une de ses cartes), 10 (voir une carte adverse),
 *    Valet (échange aveugle), Dame (échange avec vue)
 *  - Quand un joueur dit "DUTCH", la manche se termine
 *  - Score = somme des 4 cartes en main
 *  - Le joueur qui dit DUTCH et n'a PAS le moins : +10 pts de pénalité
 *  - Éliminé à 100 pts (ou le score configuré)
 *  - Dernier survivant gagne (ou moins de points si tout le monde est éliminé)
 *
 * L'interface demande simplement les scores de chaque joueur à chaque manche.
 */

window.GAME_MODULES = window.GAME_MODULES || {};

window.GAME_MODULES['dutch'] = (() => {

  // ── SESSION ─────────────────────────────────────────────────────────────
  function createSession(config, players) {
    return {
      gameId: config.id,
      gameName: config.name,
      gameEmoji: config.emoji,
      winCondition: config.winCondition,
      eliminationScore: config.targetScore || 100,
      players: players.map(p => ({
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        totalScore: 0,
        eliminated: false,
        rounds: [],       // score par manche
      })),
      round: 1,
      phase: 'playing',  // 'playing' | 'ended'
      history: [],
    };
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  function renderSession(session, container, onEnd, onSave) {
    session.onEnd  = onEnd;
    session.onSave = onSave || (() => {});

    container.innerHTML = `
      <div class="dutch-wrap">
        <div class="dutch-scoreboard-full" id="dtScoreboard"></div>
        <div class="dutch-panel">
          <div class="dutch-round-header">
            <span class="dt-round-badge">Manche <span id="dtRoundNum">${session.round}</span></span>
            <span class="dt-elim-info">Éliminé à <strong>${session.eliminationScore}</strong> pts</span>
          </div>

          <div class="dutch-entry" id="dtEntry">
            <h3 class="dt-entry-title">Saisir les scores de la manche</h3>
            <div class="dt-caller-row">
              <label>Qui a dit DUTCH ?</label>
              <div class="dt-caller-picker" id="dtCallerPicker"></div>
            </div>
            <div class="dt-scores-grid" id="dtScoresGrid"></div>
            <div id="dtPenaltyInfo" class="dt-penalty-info" style="display:none"></div>
            <button class="btn-dt-validate" id="dtBtnValidate">Valider la manche →</button>
          </div>

          <div class="dutch-log" id="dtLog"></div>
        </div>
      </div>`;

    renderDutchEntry(session, container);
    renderDutchScoreboard(session, container);
  }

  function renderDutchEntry(session, container) {
    const active = session.players.filter(p => !p.eliminated);
    let callerId = null;

    // Caller picker
    const callerPicker = container.querySelector('#dtCallerPicker');
    const renderCallers = () => {
      callerPicker.innerHTML = active.map(p => `
        <div class="dt-caller-btn ${callerId === p.playerId ? 'selected' : ''}"
             data-pid="${p.playerId}" style="--pc:${p.color}">
          <span>${p.avatar}</span>
          <span>${esc(p.name)}</span>
        </div>`).join('');
      callerPicker.querySelectorAll('.dt-caller-btn').forEach(el => {
        el.addEventListener('click', () => {
          callerId = el.dataset.pid === callerId ? null : el.dataset.pid;
          renderCallers();
          updatePenaltyInfo();
        });
      });
    };
    renderCallers();

    // Score inputs
    const grid = container.querySelector('#dtScoresGrid');
    grid.innerHTML = active.map(p => `
      <div class="dt-score-row">
        <div class="dt-sr-player" style="--pc:${p.color}">
          <span class="dt-sr-avatar">${p.avatar}</span>
          <span class="dt-sr-name">${esc(p.name)}</span>
          <span class="dt-sr-total">${p.totalScore} pts</span>
        </div>
        <div class="dt-sr-input-wrap">
          <button class="dt-minus" data-pid="${p.playerId}">−</button>
          <input type="number" class="dt-score-input" data-pid="${p.playerId}"
                 value="0" min="0" max="52" inputmode="numeric" />
          <button class="dt-plus" data-pid="${p.playerId}">+</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.dt-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = grid.querySelector(`input[data-pid="${btn.dataset.pid}"]`);
        inp.value = Math.max(0, Number(inp.value) - 1);
        updatePenaltyInfo();
      });
    });
    grid.querySelectorAll('.dt-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = grid.querySelector(`input[data-pid="${btn.dataset.pid}"]`);
        inp.value = Math.min(52, Number(inp.value) + 1);
        updatePenaltyInfo();
      });
    });
    grid.querySelectorAll('.dt-score-input').forEach(inp => {
      inp.addEventListener('input', updatePenaltyInfo);
    });

    function getScores() {
      const scores = {};
      grid.querySelectorAll('.dt-score-input').forEach(inp => {
        scores[inp.dataset.pid] = Number(inp.value) || 0;
      });
      return scores;
    }

    function updatePenaltyInfo() {
      const info = container.querySelector('#dtPenaltyInfo');
      if (!callerId) { info.style.display = 'none'; return; }
      const scores = getScores();
      const callerScore = scores[callerId];
      const minScore = Math.min(...Object.values(scores));
      const hasPenalty = callerScore > minScore;
      info.style.display = 'block';
      info.innerHTML = hasPenalty
        ? `⚠️ <strong>${active.find(p => p.playerId === callerId)?.name}</strong> a dit DUTCH mais n'a pas le moins bas → +10 pts de pénalité !`
        : `✅ <strong>${active.find(p => p.playerId === callerId)?.name}</strong> a le score le plus bas — pas de pénalité.`;
      info.className = `dt-penalty-info ${hasPenalty ? 'penalty' : 'ok'}`;
    }

    container.querySelector('#dtBtnValidate').addEventListener('click', () => {
      const scores = getScores();
      const minScore = Math.min(...Object.values(scores));

      // Apply penalty if caller doesn't have min
      active.forEach(p => {
        let s = scores[p.playerId] || 0;
        if (p.playerId === callerId && s > minScore) s += 10;
        p.rounds.push(s);
        p.totalScore += s;
        if (p.totalScore >= session.eliminationScore) {
          p.eliminated = true;
        }
      });

      session.history.push({ round: session.round, scores: { ...scores }, callerId });
      session.round++;

      // Check end
      const alive = session.players.filter(p => !p.eliminated);
      if (alive.length <= 1) {
        endGame(session, container);
        return;
      }

      // Re-render
      container.querySelector('#dtRoundNum').textContent = session.round;
      renderDutchEntry(session, container);
      renderDutchScoreboard(session, container);
      renderDutchLog(session, container);
      session.onSave();

      // Toast éliminés
      const newElim = session.players.filter(p => p.eliminated && p.rounds.length === session.round - 1);
      if (newElim.length) toast(`💀 ${newElim.map(p => p.name).join(', ')} éliminé${newElim.length>1?'s':''}!`, 'error');
    });
  }

  function renderDutchScoreboard(session, container) {
    const sb = container.querySelector('#dtScoreboard');
    // Ordre de jeu original — on identifie le meneur séparément sans trier
    const minScore = Math.min(...session.players.filter(p => !p.eliminated).map(p => p.totalScore));
    sb.innerHTML = session.players.map((p) => {
      const pct      = Math.min(100, Math.round((p.totalScore / session.eliminationScore) * 100));
      const isLeading = !p.eliminated && p.totalScore === minScore;
      return `
        <div class="dt-sb-row ${p.eliminated ? 'eliminated' : ''} ${isLeading ? 'leading' : ''}" style="--pc:${p.color}">
          <span class="dt-sb-avatar">${p.eliminated ? '💀' : p.avatar}</span>
          <div class="dt-sb-info">
            <div class="dt-sb-name">${esc(p.name)} ${p.eliminated ? '<span class="elim-badge">Éliminé</span>' : ''}</div>
            <div class="dt-sb-bar">
              <div class="dt-sb-fill ${pct >= 80 ? 'danger' : pct >= 60 ? 'warn' : ''}" style="width:${pct}%"></div>
            </div>
          </div>
          <span class="dt-sb-score">${p.totalScore}</span>
        </div>`;
    }).join('');
  }

  function renderDutchLog(session, container) {
    const log = container.querySelector('#dtLog');
    if (!session.history.length) return;
    const lastRound = session.history[session.history.length - 1];
    const entries = Object.entries(lastRound.scores)
      .map(([pid, score]) => {
        const p = session.players.find(x => x.playerId === pid);
        const bonus = pid === lastRound.callerId && score > Math.min(...Object.values(lastRound.scores)) ? '+10' : '';
        return `<span style="color:${p?.color}">${p?.avatar} ${score}${bonus ? ` <em>(${bonus})</em>` : ''}</span>`;
      }).join(' · ');

    log.innerHTML = `<div class="dt-log-entry">Manche ${lastRound.round} : ${entries}</div>` + log.innerHTML;
  }

  function endGame(session, container) {
    session.phase = 'ended';
    const finalPlayers = session.players.map(p => ({
      playerId: p.playerId,
      name: p.name,
      finalScore: p.totalScore,
    }));
    session.onEnd({
      gameId: session.gameId,
      gameName: session.gameName,
      gameEmoji: session.gameEmoji,
      winCondition: session.winCondition,
      players: finalPlayers,
      rounds: session.round - 1,
      duration: null,
    });
  }

  return { createSession, renderSession };
})();
