/**
 * DARTBOARD SVG — module partagé
 * Génère une dartboard SVG interactive avec zones cliquables.
 * Retourne un élément SVG + un callback onHit(sector, ring, value)
 *
 * Secteurs dans l'ordre horaire standard : 20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5
 * Rings : 'bull' (50), 'bull25' (25), 'triple', 'single_out', 'double', 'single_in'
 */
window.DartBoard = (() => {
  const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const COLORS = {
    black: '#1a1a1a',
    cream: '#f5f0dc',
    red:   '#c0392b',
    green: '#27ae60',
    wire:  '#888',
    bull:  '#c0392b',
    bull25:'#27ae60',
  };

  // Radii (en unités SVG, viewBox 200x200, centre 100,100)
  const R = {
    bull:       8,    // Bull (50)
    bull25:    16,    // 25
    triple_in: 58,    // intérieur triple
    triple_out:67,    // extérieur triple
    double_in: 90,    // intérieur double
    double_out:100,   // extérieur double (bord jouable)
    board:     105,   // bord physique
  };

  function polarToXY(angleDeg, radius, cx=100, cy=100) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  }

  function sectorPath(sectorIdx, r1, r2) {
    const n = SECTORS.length;
    const step = 360 / n;
    const start = sectorIdx * step - step/2;
    const end   = start + step;
    const [x1,y1] = polarToXY(start, r1);
    const [x2,y2] = polarToXY(end,   r1);
    const [x3,y3] = polarToXY(end,   r2);
    const [x4,y4] = polarToXY(start, r2);
    return `M${x1},${y1} A${r1},${r1} 0 0,1 ${x2},${y2} L${x3},${y3} A${r2},${r2} 0 0,0 ${x4},${y4} Z`;
  }

  /**
   * Crée la dartboard SVG.
   * @param {Function} onHit (sector, ring, value) — ring: 'single'|'double'|'triple'|'bull'|'bull25'|'miss'
   * @param {Object}   options { activeSectors: Set (null=tous), highlightColor }
   */
  function create(onHit, options = {}) {
    const { activeSectors = null, highlightColor = '#f97316' } = options;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'dartboard-svg');
    svg.style.userSelect = 'none';

    const isActive = (sector) => activeSectors === null || activeSectors.has(sector) || activeSectors.has(String(sector));

    // ── Fond ────────────────────────────────────────────────────────────────
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', 100); bg.setAttribute('cy', 100); bg.setAttribute('r', R.board);
    bg.setAttribute('fill', '#111'); svg.appendChild(bg);

    // ── Secteurs (single_out, triple, single_in, double) ────────────────────
    const rings = [
      { r1: R.triple_out, r2: R.double_in,  ring: 'single_out' },
      { r1: R.triple_in,  r2: R.triple_out, ring: 'triple'     },
      { r1: R.bull25,     r2: R.triple_in,  ring: 'single_in'  },
      { r1: R.double_in,  r2: R.double_out, ring: 'double'     },
    ];

    SECTORS.forEach((sector, si) => {
      const isEven = si % 2 === 0;
      const active = isActive(sector);

      rings.forEach(({ r1, r2, ring }) => {
        const isScoring = ring === 'double' || ring === 'triple';
        let fill;
        if (isScoring) {
          fill = isEven ? COLORS.red : COLORS.green;
        } else {
          fill = isEven ? COLORS.black : COLORS.cream;
        }

        if (!active) fill = '#333'; // grisé si inactif

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', sectorPath(si, r1, r2));
        path.setAttribute('fill', fill);
        path.setAttribute('stroke', COLORS.wire);
        path.setAttribute('stroke-width', '0.4');
        path.style.cursor = active ? 'pointer' : 'default';
        path.style.transition = 'opacity 0.1s';

        if (active) {
          path.addEventListener('mouseenter', () => path.setAttribute('fill', highlightColor + 'cc'));
          path.addEventListener('mouseleave', () => path.setAttribute('fill', fill));
          path.addEventListener('click', (e) => {
            e.stopPropagation();
            const mult = ring === 'double' ? 2 : ring === 'triple' ? 3 : 1;
            onHit(sector, ring === 'single_out' || ring === 'single_in' ? 'single' : ring, sector * mult);
          });
        }

        svg.appendChild(path);
      });

      // Label du secteur
      const [lx, ly] = polarToXY(si * (360/20), R.double_out + 6);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', lx); text.setAttribute('y', ly);
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '5'); text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', active ? '#eee' : '#555');
      text.textContent = sector;
      svg.appendChild(text);
    });

    // ── Bull 25 ─────────────────────────────────────────────────────────────
    const bull25Active = isActive('Bull') || isActive(25);
    const bull25 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bull25.setAttribute('cx', 100); bull25.setAttribute('cy', 100); bull25.setAttribute('r', R.bull25);
    bull25.setAttribute('fill', bull25Active ? COLORS.bull25 : '#333');
    bull25.setAttribute('stroke', COLORS.wire); bull25.setAttribute('stroke-width', '0.4');
    bull25.style.cursor = bull25Active ? 'pointer' : 'default';
    if (bull25Active) {
      bull25.addEventListener('click', e => { e.stopPropagation(); onHit('Bull', 'bull25', 25); });
      bull25.addEventListener('mouseenter', () => bull25.setAttribute('fill', highlightColor + 'cc'));
      bull25.addEventListener('mouseleave', () => bull25.setAttribute('fill', COLORS.bull25));
    }
    svg.appendChild(bull25);

    // ── Bull 50 ─────────────────────────────────────────────────────────────
    const bullActive = isActive('Bull');
    const bull = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bull.setAttribute('cx', 100); bull.setAttribute('cy', 100); bull.setAttribute('r', R.bull);
    bull.setAttribute('fill', bullActive ? COLORS.bull : '#333');
    bull.setAttribute('stroke', COLORS.wire); bull.setAttribute('stroke-width', '0.5');
    bull.style.cursor = bullActive ? 'pointer' : 'default';
    if (bullActive) {
      bull.addEventListener('click', e => { e.stopPropagation(); onHit('Bull', 'bull', 50); });
      bull.addEventListener('mouseenter', () => bull.setAttribute('fill', highlightColor + 'cc'));
      bull.addEventListener('mouseleave', () => bull.setAttribute('fill', COLORS.bull));
    }
    svg.appendChild(bull);

    // ── Label Bull ──────────────────────────────────────────────────────────
    const bullLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    bullLabel.setAttribute('x', 100); bullLabel.setAttribute('y', 100);
    bullLabel.setAttribute('text-anchor', 'middle'); bullLabel.setAttribute('dominant-baseline', 'middle');
    bullLabel.setAttribute('font-size', '4.5'); bullLabel.setAttribute('font-weight', 'bold');
    bullLabel.setAttribute('fill', '#fff'); bullLabel.setAttribute('pointer-events', 'none');
    bullLabel.textContent = 'BULL';
    svg.appendChild(bullLabel);

    return svg;
  }

  return { create, SECTORS };
})();
