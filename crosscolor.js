'use strict';

// ---------- Cell encoding ----------

function cellInGrid(v)   { return v !== 0; }
function cellIsAnchor(v) { return v !== 0 && ((v - 1) & 1) !== 0; }
function cellIsSeed(v)   { return v !== 0 && ((v - 1) & 2) !== 0; }

// ---------- Grid loading ----------

let _grids = null;

async function loadGrids() {
  if (_grids) return _grids;
  const resp = await fetch('grids.json');
  _grids = await resp.json();
  validateAllGrids(_grids);
  return _grids;
}

// ---------- Region detection ----------

const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]];

function cellKey(r, c) { return `${r},${c}`; }

function detectRegions(grid) {
  const rows = grid.length;
  const marked = grid.map(row => new Uint8Array(row.length));
  const regions = [];

  function cellAt(r, c) {
    return (r >= 0 && r < rows && c >= 0 && c < grid[r].length) ? grid[r][c] : 0;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!cellIsSeed(grid[r][c])) continue;

      for (const [dr, dc] of DIRS4) {
        const nr = r + dr, nc = c + dc;
        if (!cellInGrid(cellAt(nr, nc)) || cellIsSeed(cellAt(nr, nc)) || marked[nr]?.[nc]) continue;

        const seedSet = new Set([cellKey(r, c)]);
        const cells = [];
        const queue = [[nr, nc]];
        marked[nr][nc] = 1;
        let qi = 0;

        while (qi < queue.length) {
          const [fr, fc] = queue[qi++];
          cells.push([fr, fc]);
          for (const [dr2, dc2] of DIRS4) {
            const qr = fr + dr2, qc = fc + dc2;
            const qv = cellAt(qr, qc);
            if (!cellInGrid(qv)) continue;
            if (cellIsSeed(qv)) {
              seedSet.add(cellKey(qr, qc));
            } else if (!marked[qr]?.[qc]) {
              marked[qr][qc] = 1;
              queue.push([qr, qc]);
            }
          }
        }

        regions.push({
          seeds: [...seedSet].map(k => k.split(',').map(Number)),
          cells
        });
      }
    }
  }

  return regions;
}

// ---------- Grid validation ----------

function validateGrid(grid, tierIdx, gridIdx) {
  const errors = [], warnings = [];
  const rows = grid.length;
  const label = `Tier ${tierIdx} grid ${gridIdx}`;

  function cellAt(r, c) {
    return (r >= 0 && r < rows && c >= 0 && c < grid[r].length) ? grid[r][c] : 0;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!cellIsSeed(grid[r][c])) continue;
      if (cellInGrid(cellAt(r, c-1)) && cellInGrid(cellAt(r, c+1)))
        warnings.push(`${label}: seed at (${r},${c}) has in-grid neighbors on both sides horizontally`);
      if (cellInGrid(cellAt(r-1, c)) && cellInGrid(cellAt(r+1, c)))
        warnings.push(`${label}: seed at (${r},${c}) has in-grid neighbors above and below vertically`);
    }
  }

  const regions = detectRegions(grid);
  for (const region of regions) {
    const n = region.seeds.length;
    if (n < 2 || n > 4) {
      errors.push(`${label}: region has ${n} seed(s) — expected 2, 3, or 4`);
    } else if (n === 2) {
      const all = [...region.seeds, ...region.cells];
      const sameRow = all.every(([r]) => r === all[0][0]);
      const sameCol = all.every(([, c]) => c === all[0][1]);
      if (!sameRow && !sameCol)
        errors.push(`${label}: 2-seed region is not 1-dimensional (cells not all in same row or column)`);
    }
  }

  return { errors, warnings };
}

function validateAllGrids(grids) {
  let valid = true;
  for (let t = 0; t < grids.length; t++) {
    for (let g = 0; g < grids[t].grids.length; g++) {
      const { errors, warnings } = validateGrid(grids[t].grids[g], t, g);
      warnings.forEach(w => console.warn(w));
      errors.forEach(e => { console.error(e); valid = false; });
    }
  }
  return valid;
}

// ---------- Color pipeline ----------

function gammaExpand(v)    { return Math.pow(v / 255, 2.2); }
function gammaCompress(v)  { return Math.round(Math.pow(Math.max(0, v), 1 / 2.2) * 255); }
function randomSeedColor() { return [Math.random(), Math.random(), Math.random()]; } // linear [0,1]

// Gaussian elimination — solves A*x = b, returns x or null if singular.
function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col, best = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > best) { best = Math.abs(M[row][col]); pivot = row; }
    }
    if (best < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const s = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= s;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

// 1D: BFS distances from seed[0], then linear interpolation.
function interp1D(region, seedLinear) {
  const [s0r, s0c] = region.seeds[0];
  const [s1r, s1c] = region.seeds[1];
  const allCells = new Set([...region.seeds, ...region.cells].map(([r,c]) => cellKey(r,c)));
  const dist = new Map([[cellKey(s0r, s0c), 0]]);
  const queue = [[s0r, s0c]];
  let qi = 0;
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    for (const [dr, dc] of DIRS4) {
      const k = cellKey(r+dr, c+dc);
      if (allCells.has(k) && !dist.has(k)) {
        dist.set(k, dist.get(cellKey(r,c)) + 1);
        queue.push([r+dr, c+dc]);
      }
    }
  }
  const total = dist.get(cellKey(s1r, s1c));
  if (!total) return null;
  const colors = new Map();
  for (const [r, c] of region.cells) {
    const t = dist.get(cellKey(r, c)) / total;
    colors.set(cellKey(r, c), seedLinear[0].map((v0, ch) => v0 + t * (seedLinear[1][ch] - v0)));
  }
  return colors;
}

// 2D affine: f(x,y) = ax + by + c fitted from 3 seeds.
function interp2DAffine(region, seedLinear) {
  const A = region.seeds.map(([r, c]) => [c, r, 1]);
  const colors = new Map();
  for (let ch = 0; ch < 3; ch++) {
    const coeff = solveLinear(A, seedLinear.map(sc => sc[ch]));
    if (!coeff) return null;
    const [a, bv, cv] = coeff;
    for (const [r, c] of region.cells) {
      const k = cellKey(r, c);
      if (!colors.has(k)) colors.set(k, [0, 0, 0]);
      colors.get(k)[ch] = a * c + bv * r + cv;
    }
  }
  return colors;
}

// 2D bilinear: f(x,y) = ax + by + cxy + d fitted from 4 seeds.
function interp2DBilinear(region, seedLinear) {
  const A = region.seeds.map(([r, c]) => [c, r, c * r, 1]);
  const colors = new Map();
  for (let ch = 0; ch < 3; ch++) {
    const coeff = solveLinear(A, seedLinear.map(sc => sc[ch]));
    if (!coeff) return null;
    const [a, bv, cv, d] = coeff;
    for (const [r, c] of region.cells) {
      const k = cellKey(r, c);
      if (!colors.has(k)) colors.set(k, [0, 0, 0]);
      colors.get(k)[ch] = a * c + bv * r + cv * c * r + d;
    }
  }
  return colors;
}

// One attempt at generating colors for a grid. Returns Map<"r,c", [R,G,B]> or null.
function tryGenerateColors(grid, regions) {
  const colorMap = new Map();

  // Assign random linear-light colors to seeds
  const seedLinear = new Map();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!cellIsSeed(grid[r][c])) continue;
      const lin = randomSeedColor();
      seedLinear.set(cellKey(r, c), lin);
      colorMap.set(cellKey(r, c), lin.map(v => gammaCompress(v)));
    }
  }

  // Interpolate each region in linear space, then compress to sRGB
  for (const region of regions) {
    const sc = region.seeds.map(([r, c]) => seedLinear.get(cellKey(r, c)));
    let regionColors;
    if (region.seeds.length === 2)      regionColors = interp1D(region, sc);
    else if (region.seeds.length === 3) regionColors = interp2DAffine(region, sc);
    else                                regionColors = interp2DBilinear(region, sc);
    if (!regionColors) return null;

    for (const [r, c] of region.cells) {
      const k = cellKey(r, c);
      colorMap.set(k, regionColors.get(k).map(gammaCompress));
    }
  }

  // Out-of-gamut check
  for (const rgb of colorMap.values()) {
    if (rgb.some(v => v < 0 || v > 255)) return null;
  }

  // Build list of in-grid cells that have a computed color
  const allPos = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (colorMap.has(cellKey(r, c))) allPos.push([r, c]);

  const DIRS8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const adjPairs = new Set();

  // Adjacent step check (orthogonal + diagonal)
  const ADJ_THRESHOLD = 15;
  for (const [r, c] of allPos) {
    for (const [dr, dc] of DIRS8) {
      const k2 = cellKey(r+dr, c+dc);
      if (!colorMap.has(k2)) continue;
      const k1 = cellKey(r, c);
      const pk = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (adjPairs.has(pk)) continue;
      adjPairs.add(pk);
      const a = colorMap.get(k1), b = colorMap.get(k2);
      const d = Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
      if (d < ADJ_THRESHOLD) return null;
    }
  }

  // Non-adjacent distinguishability check
  const NONADJ_THRESHOLD = 20;
  for (let i = 0; i < allPos.length; i++) {
    for (let j = i + 1; j < allPos.length; j++) {
      const k1 = cellKey(...allPos[i]), k2 = cellKey(...allPos[j]);
      const pk = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (adjPairs.has(pk)) continue;
      const a = colorMap.get(k1), b = colorMap.get(k2);
      const d = Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
      if (d < NONADJ_THRESHOLD) return null;
    }
  }

  return colorMap;
}

// Retry until a valid assignment is found.
function generateColorsForGrid(grid, regions) {
  let attempts = 0;
  while (true) {
    attempts++;
    const result = tryGenerateColors(grid, regions);
    if (result) return { colorMap: result, attempts };
  }
}

// ---------- Light/dark mode ----------

const THEME_KEY = 'crosscolor-theme';

function initTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

function toggleTheme() {
  const next = (localStorage.getItem(THEME_KEY) || 'light') === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  document.documentElement.setAttribute('data-theme', next);
  return next;
}

// ---------- crosscolor global ----------

window.crosscolor = {
  loadGrids,
  detectRegions,
  validateAllGrids,
  generateColorsForGrid,
  initTheme,
  toggleTheme,
  cellInGrid,
  cellIsAnchor,
  cellIsSeed,

  async testGeneration(n = 10) {
    const grids = await loadGrids();
    console.log(`testGeneration(${n}): running ${n} iteration(s) per grid`);
    for (let t = 0; t < grids.length; t++) {
      for (let g = 0; g < grids[t].grids.length; g++) {
        const grid = grids[t].grids[g];
        const regions = detectRegions(grid);
        const times = [], iters = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          const { attempts } = generateColorsForGrid(grid, regions);
          times.push(performance.now() - t0);
          iters.push(attempts);
        }
        const mean = arr => arr.reduce((a,b) => a+b, 0) / n;
        console.log(
          `  "${grids[t].name}" grid ${g}:` +
          ` mean ${mean(times).toFixed(1)}ms / ${mean(iters).toFixed(1)} iters,` +
          ` worst ${Math.max(...times).toFixed(1)}ms / ${Math.max(...iters)} iters`
        );
      }
    }
  }
};
