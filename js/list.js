import {
  INR, formatDate, computeOpeningBalance, computeTotals, sortAscForBalance,
  getFilterFromURL, setFilterLabel, deriveRange, inRange
} from "./utils.js";
import { fetchEntries, deleteEntry, toCSV } from "./api.js"; // Updated API functions
import { showLoader, hideLoader } from "./loader.js"; // Add loader functions

let currentFilter = getFilterFromURL();

async function render() { // Made async
  showLoader();

  const all = await fetchEntries(); // Fetch all data from server

  const { from, to } = deriveRange(currentFilter);
  setFilterLabel(document.getElementById("filterLabel"), currentFilter);

  // Apply flow filter if present (New Feature)
  const flowFilter = document.getElementById("flowFilter").value;
  let filtered = all.filter(e => inRange(e.date, from, to));
  if (flowFilter !== "ALL") {
      filtered = filtered.filter(e => e.flow === flowFilter);
  }

  const opening = computeOpeningBalance(all, from);

  // summary
  const totalIn  = filtered.filter(e => e.flow === "IN").reduce((s,e)=>s+e.amount,0);
  const totalOut = filtered.filter(e => e.flow === "OUT").reduce((s,e)=>s+e.amount,0);
  const net = totalIn - totalOut;
  const closing = opening + net;

  document.getElementById("opening").textContent = INR.format(opening);
  document.getElementById("totalIn").textContent = INR.format(totalIn);
  document.getElementById("totalOut").textContent = INR.format(totalOut);
  document.getElementById("net").textContent = INR.format(net);
  document.getElementById("closing").textContent = INR.format(closing);

  // table (Added Party column)
  const tbody = document.getElementById("rows");
  if (!filtered.length){
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#64748b;padding:18px;">No entries in this range</td></tr>`;
    // Update table header width
    document.querySelector("#entriesTable thead tr").innerHTML = `
      <th>Date</th>
      <th>Person</th>
      <th>Party</th> <th>Mode</th>
      <th>Flow</th>
      <th>Type/Category</th>
      <th class="right">Amount</th>
      <th>Remarks</th>
      <th class="right">Balance</th>
      <th class="no-print"></th>
    `;
    hideLoader();
    return;
  }
  
  // Update table header width
  document.querySelector("#entriesTable thead tr").innerHTML = `
    <th>Date</th>
    <th>Person</th>
    <th>Party</th> <th>Mode</th>
    <th>Flow</th>
    <th>Type/Category</th>
    <th class="right">Amount</th>
    <th>Remarks</th>
    <th class="right">Balance</th>
    <th class="no-print"></th>
  `;

  let running = opening;
  const rows = sortAscForBalance(filtered).map(e => {
    running += (e.flow === "IN" ? e.amount : -e.amount);
    const badge = e.flow === "IN" ? "badge-in" : "badge-out";
    return `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td>${e.person || "—"}</td>
        <td>${e.party || "—"}</td> <td>${e.mode || "—"}</td>
        <td><span class="${badge}">${e.flow}</span></td>
        <td>${e.category || "—"}</td>
        <td class="right">${INR.format(e.amount)}</td>
        <td>${e.remarks || "—"}</td>
        <td class="right">${INR.format(running)}</td>
        <td class="right no-print"><button class="ghost danger" data-del="${e.id}">Delete</button></td>
      </tr>
    `;
  }).join("");
  tbody.innerHTML = rows;

  // delete handlers
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => { // Made async
      const id = Number(btn.getAttribute("data-del"));
      if (!confirm("Delete this entry?")) return;
      
      showLoader();
      const deleted = await deleteEntry(id); // Use new API function
      if (deleted) {
          render(); // Re-render table if successful
      } else {
          hideLoader();
          alert("Failed to delete entry.");
      }
    });
  });
  
  hideLoader();
}

document.addEventListener("DOMContentLoaded", () => {
  // custom range apply/clear
  document.getElementById("applyRange").addEventListener("click", () => {
    const from = document.getElementById("fromDate").value || null;
    const to = document.getElementById("toDate").value || null;
    if (!from || !to) return alert("Select both From and To dates");
    if (from > to) return alert("From date cannot be after To date");
    currentFilter = { mode:"CUSTOM", from, to };
    const p = new URLSearchParams({ mode:"CUSTOM", from, to });
    history.replaceState(null, "", `?${p.toString()}`);
    render();
  });
  document.getElementById("clearRange").addEventListener("click", () => {
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    currentFilter = { mode:"ALL", from:null, to:null };
    history.replaceState(null, "", `?mode=ALL`);
    render();
  });
  
  // flow filter
  document.getElementById("flowFilter").addEventListener("change", () => {
      render();
  });

  // print view with same filter
  document.getElementById("openPrint").addEventListener("click", () => {
    const p = new URLSearchParams(currentFilter);
    const flow = document.getElementById("flowFilter").value;
    if (flow !== "ALL") p.set("flow", flow); // Pass flow filter to print view
    window.open(`print.html?${p.toString()}`, "_blank");
  });

  // export
  document.getElementById("exportCsv").addEventListener("click", async () => { // Made async
    showLoader();
    const allEntries = await fetchEntries(); // Fetch all entries for export
    const csv = toCSV(allEntries);
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href:url, download:"cashflow.csv" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    hideLoader();
  });

  // import (DISABLED until a server merge endpoint is implemented)
  document.getElementById("importCsv").addEventListener("change", (e) => {
    alert("Import is temporarily disabled. You need a server endpoint to safely merge imported data with MySQL.");
    e.target.value = "";
  });

  // pre-fill custom range inputs if present in URL
  const p = new URLSearchParams(location.search);
  const f = p.get("from"); const t = p.get("to");
  if (f) document.getElementById("fromDate").value = f;
  if (t) document.getElementById("toDate").value = t;
  
  const flow = p.get("flow");
  if (flow) document.getElementById("flowFilter").value = flow;


  render();
});