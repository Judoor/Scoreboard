// ─── STATE ────────────────────────────────────────────────────────────────────
const App = {
  players: [],
  favorites: [],
  currentView: 'home',
  activeGame: null,
  activeSession: null,
  tempPlayerIds: [],
  currentAccount: null,  // { accountId, name, isAdmin }

  async init() {
    API.loadToken();
    if (API._token) {
      const me = await API.get('/auth/me');
      if (me && !me.error) {
        this.currentAccount = me;
        this.postLogin();
        return;
      }
    }
    this.showLogin();
  },

  // ─── AUTH ────────────────────────────────────────────────────────────────
  showLogin() {
    document.getElementById('authScreen').style.display = '';
    document.getElementById('appScreen').style.display  = 'none';
    document.getElementById('loginError').textContent   = '';
    document.getElementById('loginName').value  = '';
    document.getElementById('loginPin').value   = '';
    document.getElementById('loginName').focus();
  },

  async doLogin() {
    const name = document.getElementById('loginName').value.trim().slice(0, LIMITS.accountName);
    const pin  = document.getElementById('loginPin').value.replace(/\D/g,'').slice(0,4);
    const err  = document.getElementById('loginError');
    if (!name) { err.textContent = 'Entre un nom de compte'; return; }
    if (pin.length !== 4) { err.textContent = 'PIN : 4 chiffres requis'; return; }

    const res = await API.post('/auth/login', { name, pin });
    if (!res || res.error) {
      err.textContent = res?.error || 'Erreur de connexion';
      return;
    }
    API.setToken(res.token);
    this.currentAccount = { accountId: res.accountId, name: res.name, isAdmin: false };
    this.postLogin();
  },

  async doRegister() {
    const name = document.getElementById('loginName').value.trim().slice(0, LIMITS.accountName);
    const pin  = document.getElementById('loginPin').value.replace(/\D/g,'').slice(0,4);
    const err  = document.getElementById('loginError');
    if (!name || name.length < 2) { err.textContent = 'Nom : 2 caractères min'; return; }
    if (pin.length !== 4) { err.textContent = 'PIN : 4 chiffres requis'; return; }

    // Vérifier si le compte existe déjà
    const check = await API.request('GET', `/auth/check/${encodeURIComponent(name)}`);
    if (check?.exists) {
      err.textContent = 'Ce nom est déjà pris — connecte-toi ou choisis un autre nom';
      return;
    }
    const res = await API.post('/auth/register', { name, pin });
    if (!res || res.error) { err.textContent = res?.error || 'Erreur'; return; }
    API.setToken(res.token);
    this.currentAccount = { accountId: res.accountId, name: res.name, isAdmin: false };
    this.postLogin();
  },

  async doAdminLogin() {
    const pw  = document.getElementById('adminPassword').value;
    const err = document.getElementById('adminError');
    const res = await API.post('/auth/admin', { password: pw });
    if (!res || res.error) { err.textContent = res?.error || 'Mot de passe incorrect'; return; }
    API.setToken(res.token);
    this.currentAccount = { accountId: 'admin', name: 'Admin', isAdmin: true };
    closeModal('modalAdmin');
    this.postLogin();
  },

  async doLogout() {
    await API.post('/auth/logout', {});
    API.setToken(null);
    this.currentAccount = null;
    this.players = [];
    this.favorites = [];
    this.showLogin();
  },

  async postLogin() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display  = '';
    document.getElementById('accountName').textContent  = this.currentAccount.name;

    // Afficher le bouton admin si admin
    const adminNav = document.getElementById('navAdmin');
    if (adminNav) adminNav.style.display = this.currentAccount.isAdmin ? '' : 'none';

    this.players  = await API.get('/players') || [];
    this.favorites = JSON.parse(localStorage.getItem(`fav_${this.currentAccount.accountId}`) || '[]');
    this.bindGlobal();
    this.navigateTo('home');
    this.checkResume();
  },

  // ─── FAVORITES ───────────────────────────────────────────────────────────
  isFav(gameId) { return this.favorites.includes(gameId); },
  toggleFav(gameId) {
    if (this.isFav(gameId)) this.favorites = this.favorites.filter(id => id !== gameId);
    else this.favorites.push(gameId);
    localStorage.setItem(`fav_${this.currentAccount.accountId}`, JSON.stringify(this.favorites));
  },

  // ─── NAVIGATION ──────────────────────────────────────────────────────────
  navigateTo(view, params = {}) {
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

    const titles = { home:'ScoreBoard', games:'Jeux', history:'Historique',
      players:'Joueurs', game: this.activeGame?.name||'Jeu',
      session:'Partie en cours', result:'Résultats', admin:'Administration' };
    document.getElementById('topbarTitle').textContent = titles[view] || 'ScoreBoard';

    switch (view) {
      case 'home':    this.renderHome(); break;
      case 'games':   this.renderGames(); break;
      case 'history': this.renderHistory(params.gameId); break;
      case 'players': this.renderPlayers(); break;
      case 'game':    this.renderGameSetup(params.gameId); break;
      case 'admin':   this.renderAdmin(); break;
    }
  },

  // ─── HOME ────────────────────────────────────────────────────────────────
  renderHome() {
    const favGames = window.GAME_REGISTRY.filter(g => this.isFav(g.id));
    const grid = document.getElementById('homeFavGrid');
    if (!favGames.length) {
      grid.innerHTML = `<div class="empty-hint">Aucun favori — cliquez sur ⭐ pour ajouter ici.</div>`;
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

  // ─── GAMES ───────────────────────────────────────────────────────────────
  renderGames(query = '') {
    const searchEl = document.getElementById('gamesSearch');
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => this.renderGames(searchEl.value));
    }
    const q = query.toLowerCase().trim();
    const filtered = q
      ? window.GAME_REGISTRY.filter(g =>
          g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))
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
    return `
      <div class="game-tile" data-game="${g.id}" style="--gc:${g.color};--gcd:${g.colorDark||g.color}">
        <div class="gt-glow"></div>
        <button class="gt-fav ${this.isFav(g.id)?'active':''}" data-fav="${g.id}">⭐</button>
        <div class="gt-emoji">${g.emoji}</div>
        <div class="gt-name">${esc(g.name)}</div>
        <div class="gt-desc">${esc(g.description)}</div>
        <div class="gt-meta">${g.minPlayers}–${g.maxPlayers} joueurs</div>
        <button class="gt-btn">Jouer</button>
      </div>`;
  },

  bindGameTiles(container) {
    container.querySelectorAll('.game-tile').forEach(el => {
      el.querySelector('.gt-btn')?.addEventListener('click', e => {
        e.stopPropagation(); this.navigateTo('game', { gameId: el.dataset.game });
      });
      el.addEventListener('click', e => {
        if (e.target.closest('.gt-fav') || e.target.closest('.gt-btn')) return;
        this.navigateTo('game', { gameId: el.dataset.game });
      });
    });
    container.querySelectorAll('.gt-fav').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleFav(btn.dataset.fav);
        btn.classList.toggle('active', this.isFav(btn.dataset.fav));
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
    const selected = [];
    const render = () => {
      const canStart = selected.length >= config.minPlayers;
      container.innerHTML = `
        <p class="setup-hint">${config.minPlayers}–${config.maxPlayers} joueurs · ${selected.length} sélectionné${selected.length>1?'s':''}
          ${selected.length ? `<span class="setup-order-hint">— ordre : ${selected.map(id=>{
            const p=this.players.find(p=>p.id===id); return p?p.avatar:'?';
          }).join(' → ')}</span>` : ''}
        </p>
        <div class="player-pick-grid">
          ${this.players.map(p => {
            const pos = selected.indexOf(p.id); const isSel = pos !== -1;
            return `<div class="player-pick ${isSel?'selected':''}" data-pid="${p.id}" style="--pc:${p.color}">
              <span class="pp-avatar">${p.avatar}</span>
              <span class="pp-name">${esc(p.name)}</span>
              ${isSel ? `<span class="pp-check pp-order">${pos+1}</span>` : ''}
            </div>`;
          }).join('')}
          <div class="player-pick player-pick-add" id="pickAddPlayer">
            <span class="pp-avatar">＋</span><span class="pp-name">Nouveau</span>
          </div>
        </div>
        <button class="btn-start ${canStart?'':'disabled'}" id="btnStartGame" ${!canStart?'disabled':''}>
          Lancer la partie →
        </button>`;

      container.querySelectorAll('.player-pick[data-pid]').forEach(el => {
        el.addEventListener('click', () => {
          const pid = el.dataset.pid; const idx = selected.indexOf(pid);
          if (idx !== -1) selected.splice(idx, 1);
          else if (selected.length < config.maxPlayers) selected.push(pid);
          render();
        });
      });
      container.querySelector('#pickAddPlayer')?.addEventListener('click', () => {
        this.openNewPlayerModal((player, isTemp) => {
          if (isTemp) this.tempPlayerIds.push(player.id);
          if (selected.length < config.maxPlayers) selected.push(player.id);
          render();
        });
      });
      container.querySelector('#btnStartGame')?.addEventListener('click', () => {
        if (selected.length < config.minPlayers) return;
        this.startSession(config, selected.map(id => this.players.find(p => p.id === id)));
      });
    };
    render();
  },

  // ─── SESSION ─────────────────────────────────────────────────────────────
  async startSession(config, players) {
    const module = window.GAME_MODULES?.[config.id];
    if (!module) return toast('Module introuvable', 'error');
    this.activeSession = module.createSession(config, players);
    this.saveSessionToStorage();
    this.navigateTo('session');
    const container = document.getElementById('sessionContent');
    container.innerHTML = '';
    const view = document.getElementById('view-session');
    view.style.setProperty('--gc', config.color);
    view.style.setProperty('--gcd', config.colorDark || config.color);
    module.renderSession(this.activeSession, container, this.onSessionEnd.bind(this), () => this.saveSessionToStorage());
  },

  async onSessionEnd(sessionData) {
    for (const tid of this.tempPlayerIds) {
      await API.delete(`/players/${tid}`);
      this.players = this.players.filter(p => p.id !== tid);
    }
    this.tempPlayerIds = [];
    await API.post('/history', {
      gameId: sessionData.gameId, gameName: sessionData.gameName,
      gameEmoji: sessionData.gameEmoji, winCondition: sessionData.winCondition,
      players: sessionData.players, rounds: sessionData.rounds, duration: sessionData.duration,
    });
    localStorage.removeItem(`session_${this.currentAccount?.accountId}`);
    this.renderResult(sessionData);
    this.navigateTo('result');
  },

  // ─── SAVE / RESUME ───────────────────────────────────────────────────────
  saveSessionToStorage() {
    if (!this.activeSession || !this.currentAccount) return;
    try {
      localStorage.setItem(`session_${this.currentAccount.accountId}`, JSON.stringify({
        gameId: this.activeGame.id, session: this.activeSession, tempIds: this.tempPlayerIds,
      }));
    } catch(e) {}
  },

  checkResume() {
    if (!this.currentAccount) return;
    try {
      const saved = localStorage.getItem(`session_${this.currentAccount.accountId}`);
      if (!saved) return;
      const data = JSON.parse(saved);
      const config = window.GAME_REGISTRY.find(g => g.id === data.gameId);
      if (!config) { localStorage.removeItem(`session_${this.currentAccount.accountId}`); return; }
      this.showResumeBar(config, data);
    } catch(e) {}
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
      this.activeGame = config; this.tempPlayerIds = data.tempIds || [];
      this.activeSession = data.session;
      if (!window.GAME_MODULES?.[config.id]) await loadScript(config.module);
      this.navigateTo('session');
      const container = document.getElementById('sessionContent');
      container.innerHTML = '';
      const view = document.getElementById('view-session');
      view.style.setProperty('--gc', config.color);
      view.style.setProperty('--gcd', config.colorDark || config.color);
      window.GAME_MODULES[config.id].renderSession(
        this.activeSession, container, this.onSessionEnd.bind(this), () => this.saveSessionToStorage()
      );
    });
    bar.querySelector('#resumeNo').addEventListener('click', async () => {
      bar.classList.remove('active');
      for (const tid of (data.tempIds || [])) {
        await API.delete(`/players/${tid}`);
        this.players = this.players.filter(p => p.id !== tid);
      }
      localStorage.removeItem(`session_${this.currentAccount?.accountId}`);
    });
  },

  // ─── RESULT ──────────────────────────────────────────────────────────────
  renderResult(data) {
    const el = document.getElementById('view-result');
    el.style.setProperty('--gc', this.activeGame?.color || '#6366f1');
    const sorted = [...data.players].sort((a,b) =>
      data.winCondition === 'lowest' ? a.finalScore-b.finalScore : b.finalScore-a.finalScore);
    document.getElementById('resultTitle').textContent = data.gameName;
    document.getElementById('resultEmoji').textContent = data.gameEmoji;
    const medals = ['🥇','🥈','🥉'];
    document.getElementById('resultPodium').innerHTML = sorted.map((p,i) => {
      const pl = this.players.find(x=>x.id===p.playerId) || {name:p.name,avatar:'😀',color:'#888'};
      return `<div class="result-player ${i===0?'winner':''}">
        <div class="rp-medal">${medals[i]||`#${i+1}`}</div>
        <div class="rp-avatar" style="background:${pl.color}20;border-color:${pl.color}">${pl.avatar}</div>
        <div class="rp-name">${esc(pl.name)}</div>
        <div class="rp-score">${p.finalScore.toLocaleString()} pts</div>
        ${i===0?'<div class="rp-win-label">Gagnant !</div>':''}
      </div>`;
    }).join('');
    this.confetti();
  },

  confetti() {
    const colors = ['#f97316','#0ea5e9','#a855f7','#22c55e','#fbbf24','#f43f5e'];
    for (let i=0;i<60;i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${0.8+Math.random()*1.2}s;`;
        document.getElementById('confettiContainer').appendChild(el);
        setTimeout(() => el.remove(), 2500);
      }, i*30);
    }
  },

  // ─── HISTORY ─────────────────────────────────────────────────────────────
  async renderHistory(gameId) {
    const filterSel = document.getElementById('historyFilter');
    filterSel.innerHTML = `<option value="">Tous les jeux</option>` +
      window.GAME_REGISTRY.map(g =>
        `<option value="${g.id}" ${gameId===g.id?'selected':''}>${g.emoji} ${esc(g.name)}</option>`
      ).join('');
    const load = async (gId) => {
      const url = '/history?limit=20' + (gId?`&gameId=${gId}`:'');
      const history = await API.get(url) || [];
      const list = document.getElementById('historyList');
      if (!history.length) { list.innerHTML = `<div class="empty-hint">Aucune partie.</div>`; return; }
      list.innerHTML = history.map(h => this.historyRow(h, true)).join('');
      list.querySelectorAll('.del-history').forEach(btn => {
        btn.addEventListener('click', async e => {
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

  historyRow(h, withDelete=false) {
    const sorted = [...(h.players||[])].sort((a,b) =>
      h.winCondition==='lowest' ? a.finalScore-b.finalScore : b.finalScore-a.finalScore);
    const winner = sorted[0];
    const winnerPl = this.players.find(p=>p.id===winner?.playerId) || {name:winner?.name||'?',avatar:'😀'};
    return `<div class="history-row">
      <div class="hr-game">${h.gameEmoji||'🎲'} <span>${esc(h.gameName)}</span></div>
      <div class="hr-players">
        ${sorted.slice(0,4).map((p,i) => {
          const pl = this.players.find(x=>x.id===p.playerId) || {avatar:'😀',name:p.name};
          return `<div class="hr-player" title="${esc(pl.name)} — ${p.finalScore} pts">
            <span style="font-size:1.2rem">${pl.avatar}</span>
            ${i===0?'<span class="hr-winner-crown">👑</span>':''}
          </div>`;
        }).join('')}
        ${sorted.length>4?`<span class="hr-more">+${sorted.length-4}</span>`:''}
      </div>
      <div class="hr-winner-name">🏆 ${esc(winnerPl.name)} · ${winner?.finalScore??'?'} pts</div>
      <div class="hr-date">${formatDateShort(h.playedAt)}</div>
      ${withDelete?`<button class="del-history" data-id="${h.id}">✕</button>`:''}
    </div>`;
  },

  // ─── PLAYERS ─────────────────────────────────────────────────────────────
  async renderPlayers() {
    this.players = await API.get('/players') || [];
    const grid = document.getElementById('playersList');
    if (!this.players.length) {
      grid.innerHTML = `<div class="empty-hint">Aucun joueur. Créez votre premier profil !</div>`; return;
    }
    const statsAll = await Promise.all(this.players.map(p => API.get(`/players/${p.id}/stats`)));
    grid.innerHTML = this.players.map((p,i) => {
      const s = statsAll[i] || { played:0, wins:0, winRate:0 };
      return `<div class="player-card" style="--pc:${p.color}">
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
        this.players = this.players.filter(p=>p.id!==btn.dataset.id);
        this.renderPlayers();
      });
    });
  },

  // ─── ADMIN ───────────────────────────────────────────────────────────────
  async renderAdmin() {
    if (!this.currentAccount?.isAdmin) { this.navigateTo('home'); return; }
    const [stats, accounts] = await Promise.all([
      API.get('/admin/stats'), API.get('/admin/accounts')
    ]);
    const el = document.getElementById('view-admin');
    el.innerHTML = `
      <div class="admin-wrap">
        <h1>🛠 Administration</h1>
        <div class="admin-stats">
          <div class="admin-stat"><span>${stats?.accounts||0}</span>Comptes</div>
          <div class="admin-stat"><span>${stats?.players||0}</span>Joueurs</div>
          <div class="admin-stat"><span>${stats?.games||0}</span>Parties</div>
          <div class="admin-stat"><span>${stats?.sessions||0}</span>Sessions actives</div>
        </div>
        <div class="admin-actions">
          <button class="admin-btn" id="adminCleanup">🧹 Nettoyer les sessions expirées</button>
        </div>
        <h2>Comptes utilisateurs</h2>
        <div class="admin-accounts" id="adminAccountsList">
          ${(accounts||[]).map(a => `
            <div class="admin-account-row">
              <div class="aar-info">
                <strong>${esc(a.name)}</strong>
                <span>${a.players} joueurs · ${a.games} parties · créé le ${formatDateShort(a.createdAt)}</span>
              </div>
              <button class="aar-delete" data-id="${a.id}" data-name="${esc(a.name)}">Supprimer</button>
            </div>`).join('') || '<div class="empty-hint">Aucun compte.</div>'}
        </div>
      </div>`;

    el.querySelector('#adminCleanup')?.addEventListener('click', async () => {
      const res = await API.post('/admin/cleanup', {});
      toast(`${res?.removed||0} sessions supprimées`, 'success');
    });
    el.querySelectorAll('.aar-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Supprimer le compte "${btn.dataset.name}" et toutes ses données ?`)) return;
        await API.delete(`/admin/accounts/${btn.dataset.id}`);
        this.renderAdmin();
      });
    });
  },

  // ─── NEW PLAYER MODAL ────────────────────────────────────────────────────
  openNewPlayerModal(cb) {
    openModal('modalPlayer');
    const form = document.getElementById('newPlayerForm');
    const tempCheck = document.getElementById('playerTempCheck');
    form.onsubmit = null; form.reset();
    if (tempCheck) tempCheck.checked = false;
    // Appliquer les limites
    applyMaxLength(form.querySelector('[name="name"]'), LIMITS.playerName);
    applyMaxLength(form.querySelector('[name="avatar"]'), LIMITS.avatarEmoji);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get('name').trim().slice(0, LIMITS.playerName);
      if (!name) return;
      const isTemp = tempCheck?.checked || false;
      const result = await API.post('/players', {
        name, avatar: fd.get('avatar')||'😀', color: fd.get('color')||'#6366f1',
      });
      if (result && !result.error) {
        if (!this.players.find(p=>p.id===result.id)) this.players.push(result);
        closeModal('modalPlayer'); toast('Joueur ajouté !', 'success'); cb?.(result, isTemp);
      } else if (result?.error === 'exists') {
        if (!this.players.find(p=>p.id===result.player.id)) this.players.push(result.player);
        closeModal('modalPlayer'); cb?.(result.player, false);
      } else { toast(result?.error||'Erreur', 'error'); }
    };
  },

  // ─── GLOBAL BINDINGS ─────────────────────────────────────────────────────
  bindGlobal() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); this.navigateTo(el.dataset.view); closeSidebar(); });
    });
    document.getElementById('hamburger')?.addEventListener('click', openSidebar);
    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    document.getElementById('overlay')?.addEventListener('click', () => { closeSidebar(); closeModal('modalPlayer'); });
    document.getElementById('btnNewPlayer')?.addEventListener('click', () => {
      this.openNewPlayerModal(p => { if (this.currentView==='players') this.renderPlayers(); this.updatePlayerCount(); });
    });
    document.getElementById('btnBackSetup')?.addEventListener('click',  () => this.navigateTo('home'));
    document.getElementById('btnBackHome')?.addEventListener('click',   () => this.navigateTo('home'));
    document.getElementById('btnPlayAgain')?.addEventListener('click',  () => {
      if (this.activeGame) this.navigateTo('game', { gameId: this.activeGame.id }); else this.navigateTo('home');
    });
    document.getElementById('btnLogout')?.addEventListener('click', () => this.doLogout());
    document.querySelectorAll('.see-all').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); this.navigateTo(el.dataset.view); });
    });
  },
};

function openSidebar()  { document.getElementById('sidebar').classList.add('open');    document.getElementById('overlay').classList.add('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('active'); }

document.addEventListener('DOMContentLoaded', () => App.init());
