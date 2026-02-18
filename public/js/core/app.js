// ─── STATE ────────────────────────────────────────────────────────────────────
const App = {
  players: [],          // profils persistants
  favorites: [],        // ids des jeux favoris (localStorage)
  currentView: 'home',
  activeGame: null,
  activeSession: null,
  tempPlayerIds: [],    // ids joueurs temporaires créés pendant une partie

  async init() {
    this.players  = await API.get('/players') || [];
    this.favorites = JSON.parse(localStorage.getItem('fav_games') || '[]');
    this.bindGlobal();
    this.renderHome();
    this.checkResume();
  },

  // ─── NAVIGATION ─────────────────────────────────────────────────────────
  navigateTo(view, params = {}) {
    // Si on quitte une session en cours → afficher la barre de reprise
    if (this.currentView === 'session' && view !== 'session' && view !== 'result') {
      this.checkResume();
    }

    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.view === view)
    );
    const el = document.getElementById('view-' + view);
    if (el) { el.classList.add('active'); el.scrollTop = 0; }

    document.getElementById('topbarTitle').textContent = {
      home: 'ScoreBoard', games: 'Jeux', history: 'Historique', players: 'Joueurs',
      game: this.activeGame?.name || 'Jeu', session: 'Partie en cours', result: 'Résultats'
    }[view] || 'ScoreBoard';

    switch (view) {
      case 'home':    this.renderHome(); this.checkResume(); break;
      case 'games':   this.renderGames(); break;
      case 'history': this.renderHistory(params.gameId); break;
      case 'players': this.renderPlayers(); break;
      case 'game':    this.renderGameSetup(params.gameId); break;
    }
  },

  // ─── FAVORITES ───────────────────────────────────────────────────────────
  isFav(gameId) { return this.favorites.includes(gameId); },
  toggleFav(gameId) {
    if (this.isFav(gameId)) {
      this.favorites = this.favorites.filter(id => id !== gameId);
    } else {
      this.favorites.push(gameId);
    }
    localStorage.setItem('fav_games', JSON.stringify(this.favorites));
  },

  // ─── HOME ────────────────────────────────────────────────────────────────
  renderHome() {
    const favGames = window.GAME_REGISTRY.filter(g => this.isFav(g.id));
    const grid = document.getElementById('homeFavGrid');

    if (!favGames.length) {
      grid.innerHTML = `<div class="empty-hint">
        Aucun favori — cliquez sur ⭐ sur un jeu pour l'ajouter ici.
      </div>`;
    } else {
      grid.innerHTML = favGames.map(g => this.gameTileHTML(g)).join('');
      this.bindGameTiles(grid);
    }
    this.renderRecentHome();
    this.updatePlayerCount();
  },

  async renderRecentHome() {
    const list = document.getElementById('recentHome');
    const history = await API.get('/history?limit=5') || [];
    if (!history.length) {
      list.innerHTML = `<div class="empty-hint">Aucune partie — lancez votre première partie !</div>`;
      return;
    }
    list.innerHTML = history.map(h => this.historyRow(h)).join('');
  },

  updatePlayerCount() {
    const el = document.getElementById('playerCount');
    if (el) el.textContent = this.players.length;
  },

  // ─── GAMES VIEW ──────────────────────────────────────────────────────────
  renderGames(query = '') {
    const searchEl = document.getElementById('gamesSearch');
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => this.renderGames(searchEl.value));
    }

    const q = query.toLowerCase().trim();
    const filtered = q
      ? window.GAME_REGISTRY.filter(g =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q)
        )
      : window.GAME_REGISTRY;

    const grid = document.getElementById('allGamesGrid');
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-hint">Aucun jeu trouvé pour "${esc(query)}"</div>`;
      return;
    }
    grid.innerHTML = filtered.map(g => this.gameTileHTML(g)).join('');
    this.bindGameTiles(grid);
  },

  gameTileHTML(g) {
    const fav = this.isFav(g.id);
    return `
      <div class="game-tile" data-game="${g.id}" style="--gc:${g.color};--gcd:${g.colorDark || g.color}">
        <div class="gt-glow"></div>
        <button class="gt-fav ${fav ? 'active' : ''}" data-fav="${g.id}" title="Favori">⭐</button>
        <div class="gt-emoji">${g.emoji}</div>
        <div class="gt-name">${esc(g.name)}</div>
        <div class="gt-desc">${esc(g.description)}</div>
        <div class="gt-meta">${g.minPlayers}–${g.maxPlayers} joueurs</div>
        <button class="gt-btn">Jouer</button>
      </div>`;
  },

  bindGameTiles(container) {
    container.querySelectorAll('.game-tile').forEach(el => {
      el.querySelector('.gt-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateTo('game', { gameId: el.dataset.game });
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('.gt-fav') || e.target.closest('.gt-btn')) return;
        this.navigateTo('game', { gameId: el.dataset.game });
      });
    });
    container.querySelectorAll('.gt-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFav(btn.dataset.fav);
        btn.classList.toggle('active', this.isFav(btn.dataset.fav));
        // Refresh home if we're on it
        if (this.currentView === 'home') this.renderHome();
      });
    });
  },

  // ─── GAME SETUP ──────────────────────────────────────────────────────────
  async renderGameSetup(gameId) {
    const config = window.GAME_REGISTRY.find(g => g.id === gameId);
    if (!config) return this.navigateTo('home');
    this.activeGame = config;

    if (!window.GAME_MODULES?.[gameId]) await loadScript(config.module);

    const el = document.getElementById('view-game');
    el.style.setProperty('--gc', config.color);
    el.style.setProperty('--gcd', config.colorDark || config.color);

    document.getElementById('setupGameEmoji').textContent = config.emoji;
    document.getElementById('setupGameName').textContent  = config.name;
    document.getElementById('setupGameDesc').textContent  = config.description;

    this.tempPlayerIds = [];
    this.renderPlayerSelector(config);
  },

  renderPlayerSelector(config) {
    const container = document.getElementById('playerSelector');
    // Tableau ordonné : l'ordre de clic définit l'ordre de jeu
    const selected = [];

    const render = () => {
      const canStart = selected.length >= config.minPlayers;
      container.innerHTML = `
        <p class="setup-hint">${config.minPlayers}–${config.maxPlayers} joueurs · ${selected.length} sélectionné${selected.length > 1 ? 's' : ''}
          ${selected.length ? `<span class="setup-order-hint">— ordre de jeu : ${selected.map(id => {
            const p = this.players.find(p => p.id === id);
            return p ? p.avatar : '?';
          }).join(' → ')}</span>` : ''}
        </p>
        <div class="player-pick-grid">
          ${this.players.map(p => {
            const pos = selected.indexOf(p.id);
            const isSel = pos !== -1;
            return `
              <div class="player-pick ${isSel ? 'selected' : ''}" data-pid="${p.id}" style="--pc:${p.color}">
                <span class="pp-avatar">${p.avatar}</span>
                <span class="pp-name">${esc(p.name)}</span>
                ${isSel ? `<span class="pp-check pp-order">${pos + 1}</span>` : ''}
              </div>`;
          }).join('')}
          <div class="player-pick player-pick-add" id="pickAddPlayer">
            <span class="pp-avatar">＋</span>
            <span class="pp-name">Nouveau</span>
          </div>
        </div>
        <button class="btn-start ${canStart ? '' : 'disabled'}" id="btnStartGame" ${!canStart ? 'disabled' : ''}>
          Lancer la partie →
        </button>`;

      container.querySelectorAll('.player-pick[data-pid]').forEach(el => {
        el.addEventListener('click', () => {
          const pid = el.dataset.pid;
          const idx = selected.indexOf(pid);
          if (idx !== -1) {
            selected.splice(idx, 1); // retire en conservant l'ordre des autres
          } else if (selected.length < config.maxPlayers) {
            selected.push(pid);      // ajoute en fin = ordre de clic
          }
          render();
        });
      });

      container.querySelector('#pickAddPlayer')?.addEventListener('click', () => {
        this.openNewPlayerModal((player, isTemp) => {
          if (isTemp) this.tempPlayerIds.push(player.id);
          // Auto-sélectionne le nouveau joueur en dernier
          if (selected.length < config.maxPlayers) selected.push(player.id);
          render();
        });
      });

      container.querySelector('#btnStartGame')?.addEventListener('click', () => {
        if (selected.length < config.minPlayers) return;
        // Ordre garanti par le tableau
        const gamePlayers = selected.map(id => this.players.find(p => p.id === id));
        this.startSession(config, gamePlayers);
      });
    };

    render();
  },

  // ─── SESSION ─────────────────────────────────────────────────────────────
  async startSession(config, players) {
    const module = window.GAME_MODULES?.[config.id];
    if (!module) return toast('Module de jeu introuvable', 'error');

    this.activeSession = module.createSession(config, players);
    this.saveSessionToStorage();
    this.navigateTo('session');

    const container = document.getElementById('sessionContent');
    container.innerHTML = '';
    const view = document.getElementById('view-session');
    view.style.setProperty('--gc', config.color);
    view.style.setProperty('--gcd', config.colorDark || config.color);

    // On passe un callback onSave que les modules appellent après chaque action
    module.renderSession(
      this.activeSession,
      container,
      this.onSessionEnd.bind(this),
      () => this.saveSessionToStorage()   // ← callback de sauvegarde
    );
  },

  async onSessionEnd(sessionData) {
    // Supprimer les joueurs temporaires
    for (const tid of this.tempPlayerIds) {
      await API.delete(`/players/${tid}`);
      this.players = this.players.filter(p => p.id !== tid);
    }
    this.tempPlayerIds = [];

    // Sauvegarder dans l'historique (max 20)
    await API.post('/history', {
      gameId:       sessionData.gameId,
      gameName:     sessionData.gameName,
      gameEmoji:    sessionData.gameEmoji,
      winCondition: sessionData.winCondition,
      players:      sessionData.players,
      rounds:       sessionData.rounds,
      duration:     sessionData.duration,
    });

    // Effacer la session sauvegardée
    localStorage.removeItem('active_session');

    this.renderResult(sessionData);
    this.navigateTo('result');
  },

  // ─── SAVE / RESUME ───────────────────────────────────────────────────────
  saveSessionToStorage() {
    if (!this.activeSession) return;
    try {
      localStorage.setItem('active_session', JSON.stringify({
        gameId:    this.activeGame.id,
        session:   this.activeSession,
        tempIds:   this.tempPlayerIds,
      }));
    } catch(e) { /* session trop grosse, pas grave */ }
  },

  checkResume() {
    try {
      const saved = localStorage.getItem('active_session');
      if (!saved) return;
      const data = JSON.parse(saved);
      const config = window.GAME_REGISTRY.find(g => g.id === data.gameId);
      if (!config) { localStorage.removeItem('active_session'); return; }
      this.showResumeBar(config, data);
    } catch(e) { localStorage.removeItem('active_session'); }
  },

  showResumeBar(config, data) {
    const bar = document.getElementById('resumeBar');
    if (!bar) return;
    bar.innerHTML = `
      <span>🎲 Partie de ${esc(config.name)} en cours</span>
      <div class="resume-btns">
        <button class="resume-btn-yes" id="resumeYes">Reprendre</button>
        <button class="resume-btn-no"  id="resumeNo">Abandonner</button>
      </div>`;
    bar.classList.add('active');

    bar.querySelector('#resumeYes').addEventListener('click', async () => {
      bar.classList.remove('active');
      this.activeGame    = config;
      this.tempPlayerIds = data.tempIds || [];
      this.activeSession = data.session;
      if (!window.GAME_MODULES?.[config.id]) await loadScript(config.module);
      this.navigateTo('session');
      const container = document.getElementById('sessionContent');
      container.innerHTML = '';
      const view = document.getElementById('view-session');
      view.style.setProperty('--gc', config.color);
      view.style.setProperty('--gcd', config.colorDark || config.color);
      window.GAME_MODULES[config.id].renderSession(
        this.activeSession,
        container,
        this.onSessionEnd.bind(this),
        () => this.saveSessionToStorage()   // ← callback de sauvegarde
      );
    });

    bar.querySelector('#resumeNo').addEventListener('click', async () => {
      bar.classList.remove('active');
      for (const tid of (data.tempIds || [])) {
        await API.delete(`/players/${tid}`);
        this.players = this.players.filter(p => p.id !== tid);
      }
      localStorage.removeItem('active_session');
    });
  },

  // ─── RESULT ──────────────────────────────────────────────────────────────
  renderResult(data) {
    const el = document.getElementById('view-result');
    el.style.setProperty('--gc', this.activeGame?.color || '#6366f1');

    const sorted = [...data.players].sort((a, b) =>
      data.winCondition === 'lowest' ? a.finalScore - b.finalScore : b.finalScore - a.finalScore
    );

    document.getElementById('resultTitle').textContent = data.gameName;
    document.getElementById('resultEmoji').textContent = data.gameEmoji;

    const podium = document.getElementById('resultPodium');
    const medals = ['🥇','🥈','🥉'];
    podium.innerHTML = sorted.map((p, i) => {
      const pl = this.players.find(x => x.id === p.playerId) || { name: p.name, avatar: '😀', color: '#888' };
      return `
        <div class="result-player ${i === 0 ? 'winner' : ''}">
          <div class="rp-medal">${medals[i] || `#${i+1}`}</div>
          <div class="rp-avatar" style="background:${pl.color}20;border-color:${pl.color}">${pl.avatar}</div>
          <div class="rp-name">${esc(pl.name)}</div>
          <div class="rp-score">${p.finalScore.toLocaleString()} pts</div>
          ${i === 0 ? '<div class="rp-win-label">Gagnant !</div>' : ''}
        </div>`;
    }).join('');

    this.confetti();
  },

  confetti() {
    const colors = ['#f97316','#0ea5e9','#a855f7','#22c55e','#fbbf24','#f43f5e'];
    for (let i = 0; i < 60; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${0.8+Math.random()*1.2}s;`;
        document.getElementById('confettiContainer').appendChild(el);
        setTimeout(() => el.remove(), 2500);
      }, i * 30);
    }
  },

  // ─── HISTORY ─────────────────────────────────────────────────────────────
  async renderHistory(gameId) {
    const filterSel = document.getElementById('historyFilter');
    filterSel.innerHTML = `<option value="">Tous les jeux</option>` +
      window.GAME_REGISTRY.map(g =>
        `<option value="${g.id}" ${gameId === g.id ? 'selected':''}>${g.emoji} ${esc(g.name)}</option>`
      ).join('');

    const load = async (gId) => {
      const url = '/history?limit=20' + (gId ? `&gameId=${gId}` : '');
      const history = await API.get(url) || [];
      const list = document.getElementById('historyList');
      if (!history.length) {
        list.innerHTML = `<div class="empty-hint">Aucune partie enregistrée.</div>`;
        return;
      }
      list.innerHTML = history.map(h => this.historyRow(h, true)).join('');
      list.querySelectorAll('.del-history').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Supprimer cette partie ?')) return;
          await API.delete(`/history/${btn.dataset.id}`);
          load(filterSel.value);
        });
      });
    };

    filterSel.addEventListener('change', () => load(filterSel.value));
    load(gameId || '');
  },

  historyRow(h, withDelete = false) {
    const sorted = [...(h.players || [])].sort((a, b) =>
      h.winCondition === 'lowest' ? a.finalScore - b.finalScore : b.finalScore - a.finalScore
    );
    const winner = sorted[0];
    const winnerPl = this.players.find(p => p.id === winner?.playerId) || { name: winner?.name || '?', avatar: '😀' };
    return `
      <div class="history-row">
        <div class="hr-game">${h.gameEmoji || '🎲'} <span>${esc(h.gameName)}</span></div>
        <div class="hr-players">
          ${sorted.slice(0, 4).map((p, i) => {
            const pl = this.players.find(x => x.id === p.playerId) || { avatar: '😀', name: p.name };
            return `<div class="hr-player" title="${esc(pl.name)} — ${p.finalScore} pts">
              <span style="font-size:1.2rem">${pl.avatar}</span>
              ${i === 0 ? `<span class="hr-winner-crown">👑</span>` : ''}
            </div>`;
          }).join('')}
          ${sorted.length > 4 ? `<span class="hr-more">+${sorted.length - 4}</span>` : ''}
        </div>
        <div class="hr-winner-name">🏆 ${esc(winnerPl.name)} · ${winner?.finalScore ?? '?'} pts</div>
        <div class="hr-date">${formatDateShort(h.playedAt)}</div>
        ${withDelete ? `<button class="del-history" data-id="${h.id}">✕</button>` : ''}
      </div>`;
  },

  // ─── PLAYERS ─────────────────────────────────────────────────────────────
  async renderPlayers() {
    this.players = await API.get('/players') || [];
    const grid = document.getElementById('playersList');
    if (!this.players.length) {
      grid.innerHTML = `<div class="empty-hint">Aucun joueur. Créez votre premier profil !</div>`;
      return;
    }
    const statsAll = await Promise.all(this.players.map(p => API.get(`/players/${p.id}/stats`)));
    grid.innerHTML = this.players.map((p, i) => {
      const s = statsAll[i] || { played: 0, wins: 0, winRate: 0 };
      return `
        <div class="player-card" style="--pc:${p.color}">
          <div class="pc-avatar">${p.avatar}</div>
          <div class="pc-name">${esc(p.name)}</div>
          <div class="pc-stats">
            <div class="pc-stat"><span>${s.played}</span>parties</div>
            <div class="pc-stat"><span>${s.wins}</span>victoires</div>
            <div class="pc-stat"><span>${s.winRate}%</span>win rate</div>
          </div>
          <button class="pc-delete" data-id="${p.id}">✕</button>
        </div>`;
    }).join('');

    grid.querySelectorAll('.pc-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer ce joueur ?')) return;
        await API.delete(`/players/${btn.dataset.id}`);
        this.players = this.players.filter(p => p.id !== btn.dataset.id);
        this.renderPlayers();
      });
    });
  },

  // ─── NEW PLAYER MODAL ────────────────────────────────────────────────────
  openNewPlayerModal(cb) {
    openModal('modalPlayer');
    const form = document.getElementById('newPlayerForm');
    const tempCheck = document.getElementById('playerTempCheck');
    form.onsubmit = null;
    form.reset();
    if (tempCheck) tempCheck.checked = false;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const isTemp = tempCheck?.checked || false;
      const result = await API.post('/players', {
        name:   fd.get('name'),
        avatar: fd.get('avatar') || '😀',
        color:  fd.get('color') || '#6366f1',
      });
      if (result && !result.error) {
        if (!this.players.find(p => p.id === result.id)) this.players.push(result);
        closeModal('modalPlayer');
        toast('Joueur ajouté !', 'success');
        cb?.(result, isTemp);
      } else if (result?.error === 'exists') {
        if (!this.players.find(p => p.id === result.player.id)) this.players.push(result.player);
        closeModal('modalPlayer');
        cb?.(result.player, false);
      } else {
        toast('Erreur lors de la création', 'error');
      }
    };
  },

  // ─── GLOBAL BINDINGS ─────────────────────────────────────────────────────
  bindGlobal() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.navigateTo(el.dataset.view);
        closeSidebar();
      });
    });

    document.getElementById('hamburger')?.addEventListener('click', openSidebar);
    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    document.getElementById('overlay')?.addEventListener('click', () => {
      closeSidebar();
      closeModal('modalPlayer');
    });

    document.getElementById('btnNewPlayer')?.addEventListener('click', () => {
      this.openNewPlayerModal((p) => {
        if (this.currentView === 'players') this.renderPlayers();
        this.updatePlayerCount();
      });
    });

    document.getElementById('btnBackSetup')?.addEventListener('click',  () => this.navigateTo('home'));
    document.getElementById('btnBackHome')?.addEventListener('click',   () => this.navigateTo('home'));
    document.getElementById('btnPlayAgain')?.addEventListener('click',  () => {
      if (this.activeGame) this.navigateTo('game', { gameId: this.activeGame.id });
      else this.navigateTo('home');
    });

    document.querySelectorAll('.see-all').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); this.navigateTo(el.dataset.view); });
    });
  },
};

function openSidebar()  { document.getElementById('sidebar').classList.add('open');    document.getElementById('overlay').classList.add('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('active'); }

document.addEventListener('DOMContentLoaded', () => App.init());
