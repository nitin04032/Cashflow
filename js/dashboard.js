import { INR, todayISO, monthStartISO, monthEndISO, computeTotals } from "./utils.js";
import { fetchEntries } from "./api.js"; // Updated to use fetchEntries from new API
import { showLoader, hideLoader } from "./loader.js"; // Add loader functions

document.addEventListener("DOMContentLoaded", async () => { // Made async
  showLoader(); // Show loader before fetching

  const entries = await fetchEntries(); // Fetch data from server
  const today = todayISO();

  const todayRows = entries.filter(e => e.date === today);
  const { totalIn: tdIn, totalOut: tdOut } = computeTotals(todayRows);

  const mFrom = monthStartISO(), mTo = monthEndISO();
  const monthRows = entries.filter(e => e.date >= mFrom && e.date <= mTo);
  const { net: moNet } = computeTotals(monthRows);

  const { totalIn: allIn, totalOut: allOut, net: allNet } = computeTotals(entries);
  const allClosing = allNet; // since opening assumed 0 for all-time

  document.getElementById("tdIn").textContent = INR.format(tdIn);
  document.getElementById("tdOut").textContent = INR.format(tdOut);
  document.getElementById("moNet").textContent = INR.format(moNet);
  document.getElementById("allNet").textContent = INR.format(allNet);
  document.getElementById("allClosing").textContent = INR.format(allClosing);
  
  hideLoader(); // Hide loader after rendering
});