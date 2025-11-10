import {
  INR, formatDate, computeOpeningBalance, computeTotals, sortAscForBalance,
  getFilterFromURL, setFilterLabel, deriveRange, inRange
} from "./utils.js";
import { loadEntries, saveEntries, toCSV, parseCSV } from "./storage.js";

let currentFilter = getFilterFromURL();

function render() {
  const all = loadEntries();
  const { from, to } = deriveRange(currentFilter);
  setFilterLabel(document.getElementById("filterLabel"), currentFilter);

  const filtered = all.filter(e => inRange(e.date, from, to));
  const opening = computeOpeningBalance(all, from);

  // summary
  const totalIn  = filtered.filter(e => e.flow === "IN").reduce((s,e)=>s+Number(e.amount),0);
  const totalOut = filtered.filter(e => e.flow === "OUT").reduce((s,e)=>s+Number(e.amount),0);
  const net = totalIn - totalOut;
  const closing = opening + net;

  document.getElementById("opening").textContent = INR.format(opening);
  document.getElementById("totalIn").textContent = INR.format(totalIn);
  document.getElementById("totalOut").textContent = INR.format(totalOut);
  document.getElementById("net").textContent = INR.format(net);
  document.getElementById("closing").textContent = INR.format(closing);

  // table
  const tbody = document.getElementById("rows");
  if (!filtered.length){
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:18px;">No entries in this range</td></tr>`;
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
        <td class="right no-print"><button class="ghost" data-del="${e.id}">Delete</button></td>
      </tr>
    `;
  }).join("");
  tbody.innerHTML = rows;

  // delete handlers
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-del"));
      if (!confirm("Delete this entry?")) return;
      const entries2 = loadEntries().filter(e => e.id !== id);
      saveEntries(entries2);
      render();
    });
  });
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

  // print view with same filter
  document.getElementById("openPrint").addEventListener("click", () => {
    const p = new URLSearchParams(currentFilter);
    window.open(`print.html?${p.toString()}`, "_blank");
  });

  // export
  document.getElementById("exportCsv").addEventListener("click", () => {
    const csv = toCSV(loadEntries());
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href:url, download:"cashflow.csv" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // import
  document.getElementById("importCsv").addEventListener("change", (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseCSV(String(reader.result||""));
        const existing = loadEntries();
        const merged = [...existing];
        for (const row of imported){
          const idx = merged.findIndex(x=>x.id===row.id);
          if (idx>=0) merged[idx]=row; else merged.push(row);
        }
        saveEntries(merged);
        alert("Import complete");
        render();
      } catch { alert("Failed to import CSV"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // pre-fill custom range inputs if present in URL
  const p = new URLSearchParams(location.search);
  const f = p.get("from"); const t = p.get("to");
  if (f) document.getElementById("fromDate").value = f;
  if (t) document.getElementById("toDate").value = t;

  render();
});
