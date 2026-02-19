// ─── ESCAPE HTML ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── FORMAT DATE ──────────────────────────────────────────────────────────────
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast-${type} toast-show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast-show'), 2800);
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
  document.getElementById('overlay')?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
  document.getElementById('overlay')?.classList.remove('active');
}

// ─── LOAD SCRIPT ──────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="/${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = '/' + src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── API CLIENT (avec token de session) ───────────────────────────────────────
const API = {
  _token: null,

  setToken(tok) {
    this._token = tok;
    if (tok) localStorage.setItem('sb_token', tok);
    else     localStorage.removeItem('sb_token');
  },

  loadToken() {
    this._token = localStorage.getItem('sb_token');
    return this._token;
  },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this._token) h['x-session-token'] = this._token;
    return h;
  },

  async request(method, url, body) {
    const opts = { method, headers: this.headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + url, opts);
    if (res.status === 401) {
      // Session expirée → retour au login
      this.setToken(null);
      if (window.App) App.showLogin();
      return null;
    }
    return res.json();
  },

  get(url)          { return this.request('GET',    url); },
  post(url, body)   { return this.request('POST',   url, body); },
  delete(url)       { return this.request('DELETE', url); },
};

// ─── LIMITES (miroir serveur) ─────────────────────────────────────────────────
const LIMITS = {
  accountName: 32,
  playerName:  24,
  avatarEmoji:  4,
};

// ─── INPUT SANITIZER ─────────────────────────────────────────────────────────
function applyMaxLength(input, max) {
  input.setAttribute('maxlength', max);
  input.addEventListener('input', () => {
    if (input.value.length > max) input.value = input.value.slice(0, max);
  });
}
