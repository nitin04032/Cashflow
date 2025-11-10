import {
  INR, formatDate, computeOpeningBalance, computeTotals, sortAscForBalance,
  getFilterFromURL, setFilterLabel, deriveRange, inRange
} from "./utils.js";
import { loadEntries } from "./storage.js";

function render() {
  const filter = getFilterFromURL();
  setFilterLabel(document.getElementById("filterLabel"), filter);
  const { from, to } = deriveRange(filter);

  const all = loadEntries();
  const filtered = all.filter(e => inRange(e.date, from, to));
  const opening = computeOpeningBalance(all, from);

  const totalIn  = filtered.filter(e => e.flow === "IN").reduce((s,e)=>s+Number(e.amount),0);
  const totalOut = filtered.filter(e => e.flow === "OUT").reduce((s,e)=>s+Number(e.amount),0);
  const net = totalIn - totalOut;
  const closing = opening + net;

  document.getElementById("opening").textContent = INR.format(opening);
  document.getElementById("totalIn").textContent = INR.format(totalIn);
  document.getElementById("totalOut").textContent = INR.format(totalOut);
  document.getElementById("net").textContent = INR.format(net);
  document.getElementById("closing").textContent = INR.format(closing);

  const tbody = document.getElementById("rows");
  if (!filtered.length){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:18px;">No entries in this range</td></tr>`;
    return;
  }

  let running = opening;
  const rows = sortAscForBalance(filtered).map(e => {
    running += (e.flow === "IN" ? Number(e.amount) : -Number(e.amount));
    const badge = e.flow === "IN" ? "badge-in" : "badge-out";
    return `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td>${e.person || "—"}</td>
        <td>${e.mode || "—"}</td>
        <td><span class="${badge}">${e.flow}</span></td>
        <td>${e.category || "—"}</td>
        <td class="right">${INR.format(Number(e.amount))}</td>
        <td>${e.remarks || "—"}</td>
        <td class="right">${INR.format(running)}</td>
      </tr>
    `;
  }).join("");
  tbody.innerHTML = rows;
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  document.getElementById("doPrint").addEventListener("click", (e) => {
    e.preventDefault();
    window.print();
  });
});
