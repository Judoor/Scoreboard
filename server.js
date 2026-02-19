/**
 * SCOREBOARD — Serveur Express v3
 * Multi-comptes, write lock, rate limiting, headers sécurité
 */
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data', 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const SESSION_TTL    = 7 * 24 * 60 * 60 * 1000; // 7 jours
const ADMIN_TTL      =  2 * 60 * 60 * 1000;      // 2 heures

// ─── LIMITES ──────────────────────────────────────────────────────────────────
const LIMITS = {
  accountName:  32,
  playerName:   24,
  avatarEmoji:   4,
  gameId:       32,
  historyMax:   20,
};

// ─── WRITE LOCK ───────────────────────────────────────────────────────────────
let _writeLock = Promise.resolve();
function withLock(fn) {
  _writeLock = _writeLock.then(fn).catch(fn);
  return _writeLock;
}

// ─── DB ───────────────────────────────────────────────────────────────────────
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA, 'utf8'));
  } catch {
    return { accounts: [], sessions: [], players: [], history: [] };
  }
}
function saveDB(db) {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2));
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function uid()  { return crypto.randomUUID(); }
function token(){ return crypto.randomBytes(32).toString('hex'); }
function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
}
function sanitize(str, max) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, max);
}
function now() { return Date.now(); }

// ─── RATE LIMITER simple (en mémoire) ─────────────────────────────────────────
const rateLimits = new Map(); // ip → { count, resetAt }
function rateLimit(maxPerMin) {
  return (req, res, next) => {
    const ip = req.ip;
    const entry = rateLimits.get(ip) || { count: 0, resetAt: now() + 60000 };
    if (now() > entry.resetAt) { entry.count = 0; entry.resetAt = now() + 60000; }
    entry.count++;
    rateLimits.set(ip, entry);
    if (entry.count > maxPerMin) {
      return res.status(429).json({ error: 'Trop de requêtes, réessaie dans une minute.' });
    }
    next();
  };
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const tok = req.headers['x-session-token'];
  if (!tok) return res.status(401).json({ error: 'Non authentifié' });
  const db  = loadDB();
  const ses = db.sessions.find(s => s.token === tok && s.expiresAt > now());
  if (!ses) return res.status(401).json({ error: 'Session expirée' });
  req.accountId = ses.accountId;
  req.isAdmin   = ses.isAdmin || false;
  next();
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.isAdmin) return res.status(403).json({ error: 'Accès admin requis' });
    next();
  });
}

// ─── SECURITY HEADERS ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com; font-src 'self' https://fonts.gstatic.com https://api.fontshare.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

// Vérifier si un nom de compte existe
app.get('/api/auth/check/:name', rateLimit(20), (req, res) => {
  const name = sanitize(req.params.name, LIMITS.accountName);
  if (!name) return res.json({ exists: false });
  const db = loadDB();
  const exists = db.accounts.some(a => a.name.toLowerCase() === name.toLowerCase() && a.name !== 'admin');
  res.json({ exists });
});

// Créer un compte
app.post('/api/auth/register', rateLimit(10), (req, res) => {
  const name = sanitize(req.body.name || '', LIMITS.accountName);
  const pin  = String(req.body.pin || '').replace(/\D/g, '').slice(0, 4);

  if (!name || name.length < 2)   return res.status(400).json({ error: 'Nom trop court (2 caractères min)' });
  if (pin.length !== 4)           return res.status(400).json({ error: 'PIN doit être 4 chiffres' });
  if (name.toLowerCase() === 'admin') return res.status(400).json({ error: 'Nom réservé' });
  if (!/^[a-zA-Z0-9 _\-àâéèêëîïôùûüç]+$/i.test(name))
    return res.status(400).json({ error: 'Caractères invalides dans le nom' });

  withLock(() => {
    const db = loadDB();
    if (db.accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'Ce nom est déjà pris' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const account = { id: uid(), name, pinHash: hashPin(pin, salt), salt, createdAt: new Date().toISOString() };
    db.accounts.push(account);
    const tok = token();
    db.sessions.push({ token: tok, accountId: account.id, isAdmin: false, expiresAt: now() + SESSION_TTL });
    saveDB(db);
    res.status(201).json({ token: tok, accountId: account.id, name: account.name });
  });
});

// Connexion compte utilisateur
app.post('/api/auth/login', rateLimit(10), (req, res) => {
  const name = sanitize(req.body.name || '', LIMITS.accountName);
  const pin  = String(req.body.pin || '').replace(/\D/g, '').slice(0, 4);

  withLock(() => {
    const db = loadDB();
    const account = db.accounts.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (!account) return res.status(404).json({ error: 'Compte introuvable' });
    if (hashPin(pin, account.salt) !== account.pinHash)
      return res.status(401).json({ error: 'PIN incorrect' });

    // Nettoyer les vieilles sessions de ce compte
    db.sessions = db.sessions.filter(s => s.accountId !== account.id || s.expiresAt > now());
    const tok = token();
    db.sessions.push({ token: tok, accountId: account.id, isAdmin: false, expiresAt: now() + SESSION_TTL });
    saveDB(db);
    res.json({ token: tok, accountId: account.id, name: account.name });
  });
});

// Connexion admin
app.post('/api/auth/admin', rateLimit(5), (req, res) => {
  const password = req.body.password || '';
  if (password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Mot de passe incorrect' });

  withLock(() => {
    const db = loadDB();
    const tok = token();
    db.sessions.push({ token: tok, accountId: 'admin', isAdmin: true, expiresAt: now() + ADMIN_TTL });
    saveDB(db);
    res.json({ token: tok, accountId: 'admin', name: 'Admin' });
  });
});

// Déconnexion
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const tok = req.headers['x-session-token'];
  withLock(() => {
    const db = loadDB();
    db.sessions = db.sessions.filter(s => s.token !== tok);
    saveDB(db);
    res.json({ ok: true });
  });
});

// Vérifier sa session
app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = loadDB();
  if (req.isAdmin) return res.json({ accountId: 'admin', name: 'Admin', isAdmin: true });
  const account = db.accounts.find(a => a.id === req.accountId);
  if (!account) return res.status(404).json({ error: 'Compte introuvable' });
  res.json({ accountId: account.id, name: account.name, isAdmin: false });
});

// ─── PLAYERS ──────────────────────────────────────────────────────────────────
app.get('/api/players', requireAuth, (req, res) => {
  const db = loadDB();
  res.json(db.players.filter(p => p.accountId === req.accountId));
});

app.post('/api/players', requireAuth, (req, res) => {
  const name   = sanitize(req.body.name   || '', LIMITS.playerName);
  const avatar = sanitize(req.body.avatar || '😀', LIMITS.avatarEmoji);
  const color  = /^#[0-9a-f]{6}$/i.test(req.body.color) ? req.body.color : '#6366f1';
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  withLock(() => {
    const db = loadDB();
    const existing = db.players.find(p => p.accountId === req.accountId &&
      p.name.toLowerCase() === name.toLowerCase());
    if (existing) return res.status(409).json({ error: 'exists', player: existing });
    const player = { id: uid(), accountId: req.accountId, name, avatar, color, createdAt: new Date().toISOString() };
    db.players.push(player);
    saveDB(db);
    res.status(201).json(player);
  });
});

app.delete('/api/players/:id', requireAuth, (req, res) => {
  withLock(() => {
    const db = loadDB();
    const player = db.players.find(p => p.id === req.params.id);
    if (!player || player.accountId !== req.accountId)
      return res.status(404).json({ error: 'Introuvable' });
    db.players = db.players.filter(p => p.id !== req.params.id);
    saveDB(db);
    res.json({ ok: true });
  });
});

app.get('/api/players/:id/stats', requireAuth, (req, res) => {
  const db = loadDB();
  const player = db.players.find(p => p.id === req.params.id && p.accountId === req.accountId);
  if (!player) return res.status(404).json({ error: 'Introuvable' });
  const games = db.history.filter(h => h.accountId === req.accountId &&
    h.players.some(p => p.playerId === req.params.id));
  const played = games.length;
  const wins = games.filter(h => {
    const sorted = [...h.players].sort((a,b) =>
      h.winCondition === 'lowest' ? a.finalScore - b.finalScore : b.finalScore - a.finalScore);
    return sorted[0]?.playerId === req.params.id;
  }).length;
  res.json({ played, wins, winRate: played ? Math.round((wins/played)*100) : 0 });
});

// ─── HISTORY ──────────────────────────────────────────────────────────────────
app.get('/api/history', requireAuth, (req, res) => {
  const db = loadDB();
  const { gameId, limit = LIMITS.historyMax } = req.query;
  let h = db.history
    .filter(h => h.accountId === req.accountId)
    .sort((a,b) => new Date(b.playedAt) - new Date(a.playedAt));
  if (gameId) h = h.filter(g => g.gameId === gameId);
  res.json(h.slice(0, Number(limit)));
});

app.post('/api/history', requireAuth, (req, res) => {
  withLock(() => {
    const db = loadDB();
    const entry = {
      ...req.body,
      id: uid(),
      accountId: req.accountId,
      playedAt: new Date().toISOString(),
    };
    // Garder toutes les parties pour les stats mais limiter l'affichage côté GET
    db.history.push(entry);
    saveDB(db);
    res.status(201).json(entry);
  });
});

app.delete('/api/history/:id', requireAuth, (req, res) => {
  withLock(() => {
    const db = loadDB();
    const entry = db.history.find(h => h.id === req.params.id);
    if (!entry || entry.accountId !== req.accountId)
      return res.status(404).json({ error: 'Introuvable' });
    db.history = db.history.filter(h => h.id !== req.params.id);
    saveDB(db);
    res.json({ ok: true });
  });
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/admin/accounts', requireAdmin, (req, res) => {
  const db = loadDB();
  const accounts = db.accounts.map(a => ({
    id:        a.id,
    name:      a.name,
    createdAt: a.createdAt,
    players:   db.players.filter(p => p.accountId === a.id).length,
    games:     db.history.filter(h => h.accountId === a.id).length,
  }));
  res.json(accounts);
});

app.delete('/api/admin/accounts/:id', requireAdmin, (req, res) => {
  withLock(() => {
    const db = loadDB();
    const account = db.accounts.find(a => a.id === req.params.id);
    if (!account) return res.status(404).json({ error: 'Introuvable' });
    // Suppression en cascade
    db.players  = db.players.filter(p => p.accountId !== account.id);
    db.history  = db.history.filter(h => h.accountId !== account.id);
    db.sessions = db.sessions.filter(s => s.accountId !== account.id);
    db.accounts = db.accounts.filter(a => a.id !== account.id);
    saveDB(db);
    res.json({ ok: true });
  });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const db = loadDB();
  res.json({
    accounts: db.accounts.length,
    players:  db.players.length,
    games:    db.history.length,
    sessions: db.sessions.filter(s => s.expiresAt > now()).length,
  });
});

// Nettoyage des sessions expirées
app.post('/api/admin/cleanup', requireAdmin, (req, res) => {
  withLock(() => {
    const db = loadDB();
    const before = db.sessions.length;
    db.sessions = db.sessions.filter(s => s.expiresAt > now());
    saveDB(db);
    res.json({ removed: before - db.sessions.length });
  });
});

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🎲 ScoreBoard démarré sur http://localhost:${PORT}`));
