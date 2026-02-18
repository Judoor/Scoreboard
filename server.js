const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json());

// ─── FICHIERS STATIQUES (frontend) ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB ───────────────────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ players: [], history: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ─── PLAYERS ──────────────────────────────────────────────────────────────────
app.get('/api/players', (req, res) => {
  res.json(loadDB().players);
});

app.post('/api/players', (req, res) => {
  const db = loadDB();
  const { name, avatar, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const existing = db.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return res.status(409).json({ error: 'exists', player: existing });
  const player = {
    id: 'p' + Date.now(),
    name: name.trim(),
    avatar: avatar || '😀',
    color: color || '#6366f1',
    createdAt: new Date().toISOString()
  };
  db.players.push(player);
  saveDB(db);
  res.status(201).json(player);
});

app.put('/api/players/:id', (req, res) => {
  const db = loadDB();
  const idx = db.players.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  db.players[idx] = { ...db.players[idx], ...req.body, id: req.params.id };
  saveDB(db);
  res.json(db.players[idx]);
});

app.delete('/api/players/:id', (req, res) => {
  const db = loadDB();
  db.players = db.players.filter(p => p.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/players/:id/stats', (req, res) => {
  const db = loadDB();
  const { gameId } = req.query;
  let games = db.history.filter(h => h.players.some(p => p.playerId === req.params.id));
  if (gameId) games = games.filter(h => h.gameId === gameId);
  const played = games.length;
  const wins = games.filter(h => {
    const sorted = [...h.players].sort((a, b) =>
      h.winCondition === 'lowest' ? a.finalScore - b.finalScore : b.finalScore - a.finalScore
    );
    return sorted[0]?.playerId === req.params.id;
  }).length;
  res.json({ played, wins, winRate: played ? Math.round((wins / played) * 100) : 0 });
});

// ─── HISTORY ──────────────────────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  const db = loadDB();
  const { gameId, limit = 20 } = req.query;
  let h = [...db.history].sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));
  if (gameId) h = h.filter(g => g.gameId === gameId);
  res.json(h.slice(0, Number(limit)));
});

app.post('/api/history', (req, res) => {
  const db = loadDB();
  const entry = { ...req.body, id: 'h' + Date.now(), playedAt: new Date().toISOString() };
  db.history.push(entry);
  // L'affichage est limité à 20 via le paramètre limit sur le GET.
  // Toutes les parties sont conservées en base pour les statistiques des joueurs.
  saveDB(db);
  res.status(201).json(entry);
});

app.delete('/api/history/:id', (req, res) => {
  const db = loadDB();
  db.history = db.history.filter(h => h.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
// Toutes les routes inconnues renvoient index.html (navigation côté client)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🎲 ScoreBoard démarré sur http://localhost:${PORT}`));
