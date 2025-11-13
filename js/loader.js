const el = document.getElementById("appLoader");
export function showLoader(){ el?.classList.add("show"); }
export function hideLoader(){ el?.classList.remove("show"); }

// show while the page settles
showLoader();
window.addEventListener("load", () => {
  setTimeout(hideLoader, 200);
});
window.__cashflowLoader = { show: showLoader, hide: hideLoader };
