'use strict';

crosscolor.initTheme();
crosscolor.applyWordmarkGradient();

document.getElementById('theme-toggle').addEventListener('click', () => {
  crosscolor.toggleTheme();
});
