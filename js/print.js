import { INR, formatDate, computeOpeningBalance, sortAscForBalance, getFilterFromURL, setFilterLabel, deriveRange, inRange } from "./utils.js";
import { fetchEntries } from "./api.js";
import { showLoader, hideLoader } from "./loader.js";

async function render() {
  showLoader();
  const filter = getFilterFromURL();
  setFilterLabel(document.getElementById("filterLabel"), filter);
  const { from, to } = deriveRange(filter);
  const flowFilter = filter.flow;

  const all = await fetchEntries();
  let filtered = all.filter(e => inRange(e.date, from, to));
  if (flowFilter && flowFilter !== "ALL") {
      filtered = filtered.filter(e => e.flow === flowFilter);
  }

  const opening = computeOpeningBalance(all, from);

  const totalIn  = filtered.filter(e => e.flow === "IN").reduce((s,e)=>s+e.amount,0);
  const totalOut = filtered.filter(e => e.flow === "OUT").reduce((s,e)=>s+e.amount,0);
  const net = totalIn - totalOut;
  const closing = opening + net;

  document.getElementById("opening").textContent = INR.format(opening);
  document.getElementById("totalIn").textContent = INR.format(totalIn);
  document.getElementById("totalOut").textContent = INR.format(totalOut);
  document.getElementById("net").textContent = INR.format(net);
  document.getElementById("closing").textContent = INR.format(closing);

  const tbody = document.getElementById("rows");
  if (!filtered.length){
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:18px;">No entries in this range</td></tr>`;
    hideLoader();
    return;
  }

  document.querySelector(".table-wrap table thead tr").innerHTML = `
    <th>Date</th>
    <th>Person</th>
    <th>Party</th>
    <th>Mode</th>
    <th>Flow</th>
    <th>Type/Category</th>
    <th class="right">Amount</th>
    <th>Remarks</th>
    <th class="right">Balance</th>
  `;

  let running = opening;
  const rows = sortAscForBalance(filtered).map(e => {
    running += (e.flow === "IN" ? e.amount : -e.amount);
    const badge = e.flow === "IN" ? "badge-in" : "badge-out";
    return `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td>${e.person || "—"}</td>
        <td>${e.party || "—"}</td>
        <td>${e.mode || "—"}</td>
        <td><span class="${badge}">${e.flow}</span></td>
        <td>${e.category || "—"}</td>
        <td class="right">${INR.format(e.amount)}</td>
        <td>${e.remarks || "—"}</td>
        <td class="right">${INR.format(running)}</td>
      </tr>
    `;
  }).join("");
  tbody.innerHTML = rows;

  hideLoader();
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  document.getElementById("doPrint")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.print();
  });
});
