
// js/theme.js
// Handles Dark/Light mode toggling and persistence

const THEME_KEY = 'cf_theme_v1';

export function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Create toggle button if it doesn't exist
  // We'll try to append it to the .nav or .header
  // Wait for DOM content loaded if called early, but this function is likely called from module
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }
}

function injectToggle() {
  if (document.getElementById('themeToggle')) return;

  const nav = document.querySelector('.nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'themeToggle';
  btn.className = 'ghost';
  btn.setAttribute('aria-label', 'Toggle Dark Mode');
  btn.innerHTML = getIcon();
  btn.onclick = toggleTheme;

  // Insert as the first item in nav or last? Let's put it first or last.
  // Let's put it at the beginning of nav for visibility
  nav.prepend(btn);
}

function getIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  return isDark ? '☀️' : '🌙';
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');

  const btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = getIcon();
}

// Auto-init if imported
initTheme();
