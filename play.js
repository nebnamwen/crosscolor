'use strict';

const ANCHOR_MARKER  = '&#10003;'; // ✓ — see UI Refinements #6
const WIN_MARKER     = '&#10003;'; // ✓ normal win
const PERFECT_MARKER = '&#9733;';  // ★ perfect win

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

function optimalSpacerRows(tableW, gridRows) {
  const cell = 52;
  const totalDataRows = 2 + gridRows;
  const width = tableW * cell;
  const height1 = (totalDataRows + 1) * cell;
  const height2 = (totalDataRows + 2) * cell;
  return Math.abs(width - height2) < Math.abs(width - height1) ? 2 : 1;
}

function spacerTdHeight(rows) {
  return rows * 48 + (rows - 1) * 4;
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

  const movableCells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (crosscolor.cellInGrid(grid[r][c]) && !crosscolor.cellIsAnchor(grid[r][c]))
        movableCells.push([r, c]);

  const palW = paletteWidth(movableCells.length, puzzleWidth);
  const tableW = Math.max(palW, puzzleWidth);
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
        td = makeCell(null);
      } else if (tileIdx < shuffled.length) {
        const [sr, sc] = shuffled[tileIdx];
        td = makeCell('tile');
        td.style.background = rgbStyle(colorMap.get(`${sr},${sc}`));
        td.dataset.srcRow = sr;
        td.dataset.srcCol = sc;
        td.dataset.cellType = 'palette';
      } else {
        td = makeCell('vacant palette-vacant');
        td.dataset.cellType = 'palette';
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  // Spacer row
  const spacerH = spacerTdHeight(optimalSpacerRows(tableW, rows));
  const spacer = document.createElement('tr');
  spacer.className = 'spacer-row';
  for (let c = 0; c < tableW; c++) {
    const td = makeCell(null);
    td.style.height = spacerH + 'px';
    spacer.appendChild(td);
  }
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
        td.dataset.cellType = 'grid';
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  return table;
}

// ---------- Game state ----------

let selectedCell = null;
let perfectRun = true;
let solved = false;

function resetGameState() {
  selectedCell = null;
  perfectRun = true;
  solved = false;
}

// ---------- Tile helpers ----------

function setSelected(td) {
  if (selectedCell) selectedCell.classList.remove('selected');
  selectedCell = td || null;
  if (selectedCell) selectedCell.classList.add('selected');
}

function makeTile(td, bg, srcRow, srcCol) {
  td.className = 'tile';
  td.dataset.cellType = td.dataset.cellType;
  td.style.background = bg;
  td.dataset.srcRow = srcRow;
  td.dataset.srcCol = srcCol;
}

function makeVacant(td) {
  const vacantClass = td.dataset.cellType === 'palette' ? 'palette-vacant' : 'grid-vacant';
  td.className = 'vacant ' + vacantClass;
  td.dataset.cellType = td.dataset.cellType;
  td.style.background = '';
  delete td.dataset.srcRow;
  delete td.dataset.srcCol;
}

function isCorrectGridPlacement(tile, gridCell) {
  return tile.dataset.srcRow === gridCell.dataset.row &&
         tile.dataset.srcCol === gridCell.dataset.col;
}

function moveTile(from, to) {
  if (to.dataset.cellType === 'grid' && !isCorrectGridPlacement(from, to))
    perfectRun = false;
  makeTile(to, from.style.background, from.dataset.srcRow, from.dataset.srcCol);
  makeVacant(from);
}

function swapTiles(a, b) {
  if (a.dataset.cellType === 'grid' && !isCorrectGridPlacement(b, a)) perfectRun = false;
  if (b.dataset.cellType === 'grid' && !isCorrectGridPlacement(a, b)) perfectRun = false;
  const [bgA, rowA, colA] = [a.style.background, a.dataset.srcRow, a.dataset.srcCol];
  makeTile(a, b.style.background, b.dataset.srcRow, b.dataset.srcCol);
  makeTile(b, bgA, rowA, colA);
}

// ---------- Win detection ----------

function checkWin(table) {
  const gridCells = [...table.querySelectorAll('[data-row]')];
  return gridCells.length > 0 && gridCells.every(td =>
    td.classList.contains('tile') &&
    td.dataset.srcRow === td.dataset.row &&
    td.dataset.srcCol === td.dataset.col
  );
}

function showWin(table, isPerfect) {
  const marker = isPerfect ? PERFECT_MARKER : WIN_MARKER;
  table.querySelectorAll('.tile').forEach(td => {
    td.innerHTML = marker;
    td.classList.add('win-marked');
  });
  table.classList.add(isPerfect ? 'perfect' : 'solved');
}

// ---------- Interaction ----------

function handleClick(e) {
  if (solved) return;
  const td = e.target.closest('td');
  if (!td) return;
  if (td.classList.contains('anchor')) return;

  const isTile   = td.classList.contains('tile');
  const isVacant = td.classList.contains('vacant');

  if (!selectedCell) {
    if (isTile) setSelected(td);
  } else if (td === selectedCell) {
    setSelected(null);
  } else if (isTile) {
    swapTiles(selectedCell, td);
    setSelected(null);
  } else if (isVacant) {
    moveTile(selectedCell, td);
    setSelected(null);
  }

  const table = e.currentTarget;
  if (checkWin(table)) {
    solved = true;
    showWin(table, perfectRun);
  }
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

  resetGameState();
  const table = renderTable(grid, colorMap);
  table.addEventListener('click', handleClick);
  document.getElementById('play-area').replaceChildren(table);
});
