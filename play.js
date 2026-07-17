'use strict';

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

// ---------- Query params ----------

const params = new URLSearchParams(window.location.search);
const tierIndex = parseInt(params.get('tier'), 10);
const gridIndex = parseInt(params.get('grid'), 10);

crosscolor.loadGrids().then(grids => {
  if (isNaN(tierIndex) || isNaN(gridIndex) ||
      !grids[tierIndex] || !grids[tierIndex].grids[gridIndex]) {
    window.location.replace('index.html');
    return;
  }
  document.getElementById('play-area').textContent =
    `Tier ${tierIndex} "${grids[tierIndex].name}", grid ${gridIndex} — coming soon`;
});
