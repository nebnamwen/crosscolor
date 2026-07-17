'use strict';

// ---------- Theme toggle ----------

crosscolor.initTheme();

document.getElementById('theme-toggle').addEventListener('click', () => {
  crosscolor.toggleTheme();
});

// ---------- Shape preview rendering ----------

const ANCHOR_MARKER = '&#10003;'; // ✓ — see UI Refinements #6

function buildPreviewTable(grid) {
  const table = document.createElement('table');
  table.className = 'preview-grid';
  for (const row of grid) {
    const tr = document.createElement('tr');
    for (const v of row) {
      const td = document.createElement('td');
      if (crosscolor.cellInGrid(v)) {
        td.className = 'preview-cell';
        if (crosscolor.cellIsAnchor(v)) td.innerHTML = ANCHOR_MARKER;
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  return table;
}

// ---------- Tab and grid rendering ----------

const tabsEl = document.getElementById('tabs');
const previewsEl = document.getElementById('previews');

function renderTier(tier, tierIndex) {
  const section = document.createElement('div');
  section.className = 'preview-section';
  for (let g = 0; g < tier.grids.length; g++) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.dataset.tier = tierIndex;
    item.dataset.grid = g;
    item.appendChild(buildPreviewTable(tier.grids[g]));
    section.appendChild(item);
  }
  return section;
}

function renderTabs(grids, initialTab) {
  const sections = grids.map((tier, t) => renderTier(tier, t));
  let activeTab = Math.min(initialTab, grids.length - 1);

  function showTab(index) {
    activeTab = index;
    [...tabsEl.querySelectorAll('.tab-btn')].forEach((btn, i) =>
      btn.classList.toggle('active', i === index)
    );
    previewsEl.replaceChildren(sections[index]);
  }

  grids.forEach((tier, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = tier.name;
    btn.addEventListener('click', () => showTab(i));
    tabsEl.appendChild(btn);
  });

  showTab(activeTab);
}

// ---------- Navigation ----------

previewsEl.addEventListener('click', e => {
  const item = e.target.closest('.preview-item');
  if (!item) return;
  window.location.href = `play.html?tier=${item.dataset.tier}&grid=${item.dataset.grid}`;
});

// ---------- Boot ----------

crosscolor.loadGrids().then(grids => {
  const tier = parseInt(new URLSearchParams(window.location.search).get('tier'), 10);
  renderTabs(grids, isNaN(tier) ? 0 : tier);
});
