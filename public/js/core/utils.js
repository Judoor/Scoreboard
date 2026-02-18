// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = window.SCOREBOARD_API || '/api';

// ─── API ──────────────────────────────────────────────────────────────────────
window.API = {
  async fetch(path, opts = {}) {
    try {
      const r = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch (e) {
      console.error('[API]', path, e);
      return null;
    }
  },
  get: (p) => window.API.fetch(p),
  post: (p, body) => window.API.fetch(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p, body) => window.API.fetch(p, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (p) => window.API.fetch(p, { method: 'DELETE' }),
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
window.esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

window.formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

window.formatDateShort = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
window.toast = (msg, type = 'info') => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
};

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
window.openModal = (id) => {
  document.getElementById(id)?.classList.add('active');
  document.getElementById('overlay')?.classList.add('active');
};
window.closeModal = (id) => {
  document.getElementById(id)?.classList.remove('active');
  document.getElementById('overlay')?.classList.remove('active');
};

// ─── PLAYER AVATAR ────────────────────────────────────────────────────────────
window.playerBadge = (player, size = 'md') => {
  return `<div class="player-badge player-badge-${size}" style="--pc:${player?.color || '#6366f1'}">
    <span class="pb-avatar">${player?.avatar || '😀'}</span>
  </div>`;
};

// ─── DYNAMIC SCRIPT LOADER ────────────────────────────────────────────────────
window.loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve();
  const s = document.createElement('script');
  s.src = src;
  s.onload = resolve;
  s.onerror = reject;
  document.head.appendChild(s);
});
