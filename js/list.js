// js/list.js (updated for updateEntry)
import { INR, formatDate, computeOpeningBalance, sortAscForBalance } from "./utils.js";
import { fetchEntries, deleteEntry, toCSV, updateEntry } from "./api.js";
import { showLoader, hideLoader } from "./loader.js";

/* State and helpers (same as before) */
let allEntries = [];
let filtered = [];
let currentSort = { key: 'date', dir: 'desc' };
let currentPage = 1;
let pageSize = Number(document.getElementById('pageSize')?.value || 25);
let totalPages = 1;
let selected = new Set();

function debounce(fn, wait=300){ let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); }; }
function money(v){ return INR.format(v); }
function escapeHtml(s=''){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

/* Filters / sorting / pagination logic (same as earlier) */
function applyFilters() {
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  const flow = document.getElementById("flowFilter").value;
  const from = document.getElementById("fromDate").value || null;
  const to = document.getElementById("toDate").value || null;

  filtered = allEntries.filter(e => {
    if (flow !== "ALL" && e.flow !== flow) return false;
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (!q) return true;
    const hay = `${e.person||''} ${e.party||''} ${e.category||''} ${e.remarks||''} ${e.mode||''}`.toLowerCase();
    return hay.includes(q);
  });

  document.getElementById("totalCount").textContent = allEntries.length;
  document.getElementById("shownCount").textContent = filtered.length;
}

function applySort() {
  const k = currentSort.key; const d = currentSort.dir;
  filtered.sort((a,b)=>{
    let va = a[k], vb = b[k];
    if (k === 'amount') { va = Number(va); vb = Number(vb); }
    if (va === vb) return a.id - b.id;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va > vb) return d === 'asc' ? 1 : -1;
    if (va < vb) return d === 'asc' ? -1 : 1;
    return 0;
  });
}

function paginateAndRender() {
  pageSize = Number(document.getElementById("pageSize").value);
  totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage -1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  renderTable(pageRows);
  document.getElementById("curPage").textContent = currentPage;
}

function formatRow(e, running) {
  const badge = e.flow === "IN" ? "badge-in" : "badge-out";
  const receiptIcon = e.receipt_url ? `<button class="ghost" data-receipt="${e.receipt_url}" title="View receipt">📎</button>` : "";
  return `
    <tr data-id="${e.id}">
      <td class="td-check"><input type="checkbox" class="row-check" data-id="${e.id}" ${selected.has(e.id) ? 'checked' : ''}></td>
      <td data-label="Date">${formatDate(e.date)}</td>
      <td data-label="Person">${escapeHtml(e.person)||'—'}</td>
      <td data-label="Party">${escapeHtml(e.party)||'—'}</td>
      <td data-label="Mode">${escapeHtml(e.mode)||'—'}</td>
      <td data-label="Flow"><span class="${badge}">${e.flow}</span></td>
      <td data-label="Category">${escapeHtml(e.category)||'—'}</td>
      <td data-label="Amount" class="right">${money(e.amount)}</td>
      <td data-label="Remarks">${escapeHtml(e.remarks)||'—'}</td>
      <td data-label="Balance" class="right">${money(running)}</td>
      <td data-label="Actions" class="no-print action-cell">
        <button class="ghost" data-view="${e.id}" title="View">View</button>
        <button class="ghost" data-edit="${e.id}" title="Edit">Edit</button>
        ${receiptIcon}
        <button class="ghost danger" data-del="${e.id}" title="Delete">Delete</button>
      </td>
    </tr>
  `;
}

function renderTable(rows) {
  const tbody = document.getElementById("rows");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:#64748b;padding:18px;">No entries</td></tr>`;
    return;
  }

  const firstDate = rows.length ? rows[0].date : null;
  const opening = computeOpeningBalance(allEntries, firstDate);
  let running = opening;

  const html = rows.map(r => {
    running += (r.flow === "IN" ? r.amount : -r.amount);
    return formatRow(r, running);
  }).join("");
  tbody.innerHTML = html;

  // attach handlers
  tbody.querySelectorAll(".row-check").forEach(cb => cb.addEventListener("change", ()=>{
    const id = Number(cb.dataset.id);
    if (cb.checked) selected.add(id); else selected.delete(id);
    toggleBulkDelete();
  }));

  tbody.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async ()=>{
    const id = Number(b.getAttribute("data-del"));
    if (!confirm("Delete this entry?")) return;
    showLoader();
    const ok = await deleteEntry(id);
    hideLoader();
    if (ok) { toast("Deleted"); await load(); } else toast("Delete failed", { type: "error" });
  }));

  tbody.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", ()=>{
    const id = Number(b.getAttribute("data-view")); openViewModal(id);
  }));

  tbody.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", async ()=>{
    const id = Number(b.getAttribute("data-edit"));
    await openEditModal(id);
  }));

  tbody.querySelectorAll("[data-receipt]").forEach(b => b.addEventListener("click", ()=>{
    const url = b.getAttribute("data-receipt"); openReceiptModal(url);
  }));

  const selectAll = document.getElementById("selectAll");
  selectAll.checked = rows.every(r => selected.has(r.id)) && rows.length>0;
}

/* Bulk delete */
function toggleBulkDelete(){ document.getElementById("bulkDelete").disabled = selected.size === 0; }

async function bulkDelete(){
  if (!selected.size) return;
  if (!confirm(`Delete ${selected.size} selected entries? This can't be undone.`)) return;
  showLoader();
  let okAll = true;
  for (const id of Array.from(selected)) {
    const ok = await deleteEntry(id);
    if (!ok) okAll = false;
  }
  hideLoader();
  selected.clear();
  toggleBulkDelete();
  await load();
  toast(okAll ? "Deleted selected" : "Some deletes failed", { type: okAll ? "info" : "error" });
}

/* Modals */
function openModal(htmlBody, footerHtml = '') {
  const overlay = document.getElementById("modalOverlay");
  document.getElementById("modalBody").innerHTML = htmlBody;
  document.getElementById("modalFooter").innerHTML = footerHtml;
  overlay.style.display = "grid"; overlay.setAttribute("aria-hidden","false");
}
function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  overlay.style.display = "none"; overlay.setAttribute("aria-hidden","true");
}
function openReceiptModal(url) {
  const overlay = document.getElementById("receiptModal");
  const body = document.getElementById("receiptBody");
  if (url && /\.(jpe?g|png|gif|webp)$/i.test(url)) {
    body.innerHTML = `<img src="${url}" style="max-width:100%;max-height:70vh;border-radius:8px" alt="Receipt">`;
  } else if (url) {
    body.innerHTML = `<a href="${url}" target="_blank" rel="noopener">Open Receipt</a>`;
  } else body.innerHTML = "No receipt.";
  overlay.style.display = "grid"; overlay.setAttribute("aria-hidden","false");
}
function closeReceiptModal(){ document.getElementById("receiptModal").style.display = "none"; document.getElementById("receiptModal").setAttribute("aria-hidden","true"); }

document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("receiptClose").addEventListener("click", closeReceiptModal);

/* View modal */
function openViewModal(id) {
  const entry = allEntries.find(e => e.id === id);
  if (!entry) return toast("Entry not found", { type: "error" });
  const html = `
    <dl style="display:grid;grid-template-columns:120px 1fr;gap:8px;">
      <dt>Date</dt><dd>${formatDate(entry.date)}</dd>
      <dt>Flow</dt><dd>${entry.flow}</dd>
      <dt>Amount</dt><dd>${money(entry.amount)}</dd>
      <dt>Person</dt><dd>${escapeHtml(entry.person||'—')}</dd>
      <dt>Party</dt><dd>${escapeHtml(entry.party||'—')}</dd>
      <dt>Mode</dt><dd>${escapeHtml(entry.mode||'—')}</dd>
      <dt>Category</dt><dd>${escapeHtml(entry.category||'—')}</dd>
      <dt>Remarks</dt><dd>${escapeHtml(entry.remarks||'—')}</dd>
      <dt>Receipt</dt><dd>${entry.receipt_url ? `<button class="ghost" data-receipt="${entry.receipt_url}">View</button>` : '—'}</dd>
    </dl>
  `;
  const footer = `<button id="modalEditBtn" class="ghost">Edit</button> <button id="modalDelBtn" class="ghost danger">Delete</button>`;
  openModal(html, footer);

  document.getElementById("modalEditBtn").addEventListener("click", ()=>{ closeModal(); openEditModal(id); });
  document.getElementById("modalDelBtn").addEventListener("click", async ()=> {
    if (!confirm("Delete this entry?")) return;
    showLoader();
    const ok = await deleteEntry(id);
    hideLoader();
    if (ok) { closeModal(); await load(); toast("Deleted"); } else toast("Delete failed",{type:"error"});
  });
  const btn = document.querySelector("[data-receipt]");
  if (btn) btn.addEventListener("click", ()=> openReceiptModal(btn.getAttribute("data-receipt")));
}

/* Edit modal (uses updateEntry) */
async function openEditModal(id) {
  const entry = allEntries.find(e => e.id === id);
  if (!entry) return toast("Entry not found", { type: "error" });

  // Simple inline edit form HTML
  const html = `
    <form id="editForm" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label><span>Date</span><input type="date" id="editDate" value="${entry.date}" required></label>
      <label><span>Amount</span><input type="number" id="editAmount" value="${entry.amount}" step="0.01" required></label>
      <label style="grid-column:1/3"><span>Category</span><input type="text" id="editCategory" value="${escapeHtml(entry.category||'')}" ></label>
      <label style="grid-column:1/3"><span>Remarks</span><input type="text" id="editRemarks" value="${escapeHtml(entry.remarks||'')}" ></label>
    </form>
  `;
  const footer = `<button id="saveEditBtn" class="button">Save</button> <button id="cancelEditBtn" class="ghost">Cancel</button>`;
  openModal(html, footer);

  document.getElementById("cancelEditBtn").addEventListener("click", closeModal);
  document.getElementById("saveEditBtn").addEventListener("click", async () => {
    const newDate = document.getElementById("editDate").value;
    const newAmount = Number(document.getElementById("editAmount").value);
    const newCategory = document.getElementById("editCategory").value.trim();
    const newRemarks = document.getElementById("editRemarks").value.trim();

    if (!newDate || !(newAmount > 0)) return toast("Date and positive amount required", { type: "error" });

    showLoader();
    const res = await updateEntry(id, {
      date: newDate,
      amount: newAmount,
      category: newCategory || null,
      remarks: newRemarks || null
    });
    hideLoader();
    if (res && res.success) {
      closeModal();
      await load();
      toast("Updated");
    } else {
      toast("Update failed: " + (res?.error || "unknown"), { type: "error" });
    }
  });
}

/* Load & controls */
async function load() {
  showLoader();
  try {
    allEntries = await fetchEntries();
    allEntries.forEach(e => { e.amount = Number(e.amount); e.id = Number(e.id); });
    currentPage = 1;
    selected.clear();
    applyFilters(); applySort(); paginateAndRender(); toggleBulkDelete();
  } catch (err) {
    console.error(err); toast("Failed to load entries", { type: "error" });
  } finally {
    hideLoader();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load();

  const search = document.getElementById("q");
  const onSearch = debounce(()=>{ currentPage = 1; applyFilters(); applySort(); paginateAndRender(); }, 350);
  if (search) search.addEventListener("input", onSearch);

  document.getElementById("flowFilter").addEventListener("change", ()=>{ currentPage = 1; applyFilters(); applySort(); paginateAndRender(); });
  document.getElementById("fromDate").addEventListener("change", ()=>{ currentPage = 1; applyFilters(); applySort(); paginateAndRender(); });
  document.getElementById("toDate").addEventListener("change", ()=>{ currentPage = 1; applyFilters(); applySort(); paginateAndRender(); });
  document.getElementById("pageSize").addEventListener("change", ()=>{ currentPage = 1; paginateAndRender(); });

  document.getElementById("prevPage").addEventListener("click", ()=>{ if (currentPage > 1) { currentPage--; paginateAndRender(); }});
  document.getElementById("nextPage").addEventListener("click", ()=>{ if (currentPage < totalPages) { currentPage++; paginateAndRender(); }});

  document.getElementById("selectAll").addEventListener("change", (e)=> {
    const check = e.target.checked;
    const rows = document.querySelectorAll("#rows tr");
    rows.forEach(r=>{
      const id = Number(r.getAttribute("data-id"));
      const cb = r.querySelector(".row-check");
      if (!cb) return;
      cb.checked = check;
      if (check) selected.add(id); else selected.delete(id);
    });
    toggleBulkDelete();
  });

  document.getElementById("bulkDelete").addEventListener("click", bulkDelete);

  document.getElementById("exportCsv").addEventListener("click", async ()=>{
    showLoader();
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href:url, download:"cashflow_export.csv" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    hideLoader();
  });

  document.getElementById("clearFilters").addEventListener("click", ()=>{
    document.getElementById("q").value = "";
    document.getElementById("flowFilter").value = "ALL";
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    currentPage = 1; applyFilters(); applySort(); paginateAndRender();
  });

  document.querySelectorAll("th.sortable").forEach(h => {
    h.addEventListener("click", () => {
      const key = h.getAttribute("data-sort");
      if (currentSort.key === key) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
      else { currentSort.key = key; currentSort.dir = 'asc'; }
      document.querySelectorAll("th.sortable .sort-ind").forEach(si => si.textContent = '');
      h.querySelector(".sort-ind").textContent = currentSort.dir === 'asc' ? '▲' : '▼';
      applySort(); paginateAndRender();
    });
  });

  document.getElementById("modalOverlay").addEventListener("click", (e)=>{ if (e.target.id === "modalOverlay") closeModal(); });
  document.getElementById("receiptModal").addEventListener("click", (e)=>{ if (e.target.id === "receiptModal") closeReceiptModal(); });
});

/* Toast helper */
function toast(message, opts={}) {
  const root = document.getElementById("toast");
  if (!root) { alert(message); return; }
  root.innerHTML = `<div class="msg ${opts.type==="error"?"error":""}">${message}</div>`;
  root.style.opacity = 1;
  setTimeout(()=>{ root.innerHTML = ""; root.style.opacity = 0; }, opts.timeout || 3800);
}
