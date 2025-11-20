
// js/theme.js
// Handles Dark/Light mode toggling, persistence, and active nav highlights

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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectToggle();
        highlightActiveNav();
    });
  } else {
    injectToggle();
    highlightActiveNav();
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

  // Insert as the first item in nav or last? Let's put it first.
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

  // Dispatch a resize event because charts might need to redraw colors
  window.dispatchEvent(new Event('resize'));
}

function highlightActiveNav() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";

    const links = document.querySelectorAll('.nav a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === page || (page === '' && href === 'index.html')) {
            // Remove ghost class if present to make it solid, or just add active styling
            // The current styling uses .ghost for inactive and solid for buttons.
            // Usually, "Add Entry" is solid button. "Dashboard" and "Entries" are ghost.
            // If we want to show "Active", maybe we give it a solid background?

            // Simpler approach: specific active styling
            link.classList.add('active-nav');
            // If it was ghost, remove ghost to make it solid (active)
            if (link.classList.contains('ghost')) {
                link.classList.remove('ghost');
            }
        }
    });
}

// Auto-init if imported
initTheme();
