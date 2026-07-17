'use strict';

const themeToggle = document.getElementById('theme-toggle');

function updateToggleLabel(theme) {
  themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

const initialTheme = crosscolor.initTheme();
updateToggleLabel(initialTheme);

themeToggle.addEventListener('click', () => {
  updateToggleLabel(crosscolor.toggleTheme());
});
