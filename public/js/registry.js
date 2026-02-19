/**
 * REGISTRE DES JEUX
 * ─────────────────────────────────────────────────────
 * Pour ajouter un nouveau jeu :
 *   1. Crée  js/games/mon-jeu.js  avec la structure GameModule
 *   2. Ajoute une entrée ici dans GAME_REGISTRY
 *   3. C'est tout — il apparaît automatiquement sur le site.
 */

window.GAME_REGISTRY = [
  {
    id: 'farkle',
    name: 'Farkle',
    emoji: '🎲',
    color: '#f97316',
    colorDark: '#7c2d06',
    description: 'Dés • Saisie manuelle • Joueurs illimités',
    minPlayers: 2,
    maxPlayers: 20,
    winCondition: 'highest',
    targetScore: 10000,
    module: 'js/games/farkle.js',
  },
  {
    id: 'dutch',
    name: 'Dutch',
    emoji: '🃏',
    color: '#0ea5e9',
    colorDark: '#0c4a6e',
    description: 'Cartes • Le moins de points possible',
    minPlayers: 2,
    maxPlayers: 6,
    winCondition: 'lowest',
    targetScore: 100,           // Éliminé à 100 pts
    module: 'js/games/dutch.js',
  },
  // ── Yams ─────────────────────────────────────────────────────────────────
  {
    id: 'yams',
    name: 'Yams',
    emoji: '🎲',
    color: '#a855f7',
    colorDark: '#4a044e',
    description: 'Dés • Remplis ta grille de combinaisons',
    minPlayers: 1,
    maxPlayers: 6,
    winCondition: 'highest',
    targetScore: null,
    module: 'js/games/yams.js',
  },
  {
    id: 'darts301',
    name: 'Fléchettes 301',
    emoji: '🎯',
    color: '#ef4444',
    colorDark: '#7f1d1d',
    description: 'Fléchettes • 301 / 501 / 701 — décompte vers 0',
    minPlayers: 2,
    maxPlayers: 8,
    winCondition: 'lowest',
    targetScore: null,
    module: 'js/games/darts301.js',
  },
  {
    id: 'dartscricket',
    name: 'Cricket',
    emoji: '🎯',
    color: '#14b8a6',
    colorDark: '#134e4a',
    description: 'Fléchettes • Cricket classique, Cut Throat ou aléatoire',
    minPlayers: 2,
    maxPlayers: 8,
    winCondition: 'highest',
    targetScore: null,
    module: 'js/games/dartscricket.js',
  },
  {
  id:           'skull-king',
  name:         'Skull King',
  emoji:        '💀',
  color:        '#0ea5e9',
  colorDark:    '#0c4a6e',
  description:  'Cartes • Pariez sur vos plis, gagnez gros ou coulez',
  minPlayers:   2,
  maxPlayers:   8,
  winCondition: 'highest',
  targetScore:  null,
  module:       'js/games/skull-king.js',
},
];
