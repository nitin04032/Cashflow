// Minimal loader controller — shows while page initializes or during heavy ops.
const el = document.getElementById("appLoader");

// expose small API
export function showLoader(){ el?.classList.add("show"); }
export function hideLoader(){ el?.classList.remove("show"); }

// show while the page settles
showLoader();
window.addEventListener("load", () => {
  // small delay so it feels smooth even on fast loads
  setTimeout(hideLoader, 200);
});

// Optional: use in other modules
window.__cashflowLoader = { show: showLoader, hide: hideLoader };
