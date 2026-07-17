'use strict';

const ANCHOR_MARKER = '&#10003;'; // ✓ — see UI Refinements #6

// ---------- Theme toggle ----------

const themeToggle = document.getElementById('theme-toggle');

function updateToggleLabel(theme) {
  themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

const initialTheme = crosscolor.initTheme();
updateToggleLabel(initialTheme);

themeToggle.addEventListener('click', () => {
  updateToggleLabel(crosscolor.toggleTheme());
});

// ---------- Palette geometry ----------

function paletteWidth(tileCount, puzzleWidth) {
  let w = Math.max(3, Math.ceil(tileCount / 2));
  if (w % 2 !== puzzleWidth % 2) w += 1;
  return w;
}

// ---------- Table rendering ----------

function rgbStyle(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function makeCell(cls) {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  return td;
}

function renderTable(grid, colorMap) {
  const rows = grid.length;
  const puzzleWidth = Math.max(...grid.map(r => r.length));

  // Count movable (non-anchor in-grid) tiles
  const movableCells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (crosscolor.cellInGrid(grid[r][c]) && !crosscolor.cellIsAnchor(grid[r][c]))
        movableCells.push([r, c]);

  const palW = paletteWidth(movableCells.length, puzzleWidth);
  const tableW = Math.max(palW, puzzleWidth);

  // Palette tiles in shuffled order
  const shuffled = movableCells.slice().sort(() => Math.random() - 0.5);

  const table = document.createElement('table');
  table.id = 'play-table';
  table.className = 'play-grid';

  // Palette rows (2 rows)
  const palOffset = Math.floor((tableW - palW) / 2);
  for (let pr = 0; pr < 2; pr++) {
    const tr = document.createElement('tr');
    for (let pc = 0; pc < tableW; pc++) {
      const palCol = pc - palOffset;
      const tileIdx = pr * palW + palCol;
      let td;
      if (palCol < 0 || palCol >= palW) {
        td = makeCell(null); // absent — outside palette area
      } else if (tileIdx < shuffled.length) {
        const [sr, sc] = shuffled[tileIdx];
        td = makeCell('tile');
        td.style.background = rgbStyle(colorMap.get(`${sr},${sc}`));
        td.dataset.srcRow = sr;
        td.dataset.srcCol = sc;
      } else {
        td = makeCell('vacant palette-vacant'); // empty palette slot
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  // Spacer row
  const spacer = document.createElement('tr');
  spacer.className = 'spacer-row';
  for (let c = 0; c < tableW; c++) spacer.appendChild(makeCell(null));
  table.appendChild(spacer);

  // Grid rows
  const gridOffset = Math.floor((tableW - puzzleWidth) / 2);
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < tableW; c++) {
      const gc = c - gridOffset;
      const v = (gc >= 0 && gc < grid[r].length) ? grid[r][gc] : 0;
      let td;
      if (!crosscolor.cellInGrid(v)) {
        td = makeCell(null);
      } else if (crosscolor.cellIsAnchor(v)) {
        td = makeCell('tile anchor');
        td.style.background = rgbStyle(colorMap.get(`${r},${gc}`));
        td.innerHTML = ANCHOR_MARKER;
      } else {
        td = makeCell('vacant grid-vacant');
        td.dataset.row = r;
        td.dataset.col = gc;
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  return table;
}

// ---------- Boot ----------

const params = new URLSearchParams(window.location.search);
const tierIndex = parseInt(params.get('tier'), 10);
const gridIndex = parseInt(params.get('grid'), 10);

crosscolor.loadGrids().then(grids => {
  if (isNaN(tierIndex) || isNaN(gridIndex) ||
      !grids[tierIndex] || !grids[tierIndex].grids[gridIndex]) {
    window.location.replace('index.html');
    return;
  }

  const grid = grids[tierIndex].grids[gridIndex];
  const regions = crosscolor.detectRegions(grid);
  const { colorMap } = crosscolor.generateColorsForGrid(grid, regions);

  const playArea = document.getElementById('play-area');
  playArea.replaceChildren(renderTable(grid, colorMap));
});
