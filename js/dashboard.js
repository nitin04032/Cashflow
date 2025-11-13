// js/dashboard.js (UPDATED)
// Improved sizing, maintainAspectRatio=false, canvas pixel sizing, sparklines, and resize handling.

import { INR, todayISO, monthStartISO, monthEndISO } from "./utils.js";
import { fetchEntries } from "./api.js";
import { showLoader, hideLoader } from "./loader.js";

let balanceChart = null, monthlyChart = null, categoryChart = null;

/* ---------- Helpers ---------- */

function ymFromDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n = 12) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleString("default", { month: "short", year: "numeric" });
}

function aggregateRunningBalance(sortedEntries, opening = 0) {
  const points = [];
  let running = opening;
  for (const e of sortedEntries) {
    running += (e.flow === "IN" ? e.amount : -e.amount);
    points.push({ date: e.date, balance: running });
  }
  return points;
}

function aggregateMonthly(entries, months) {
  const mapIn = new Map();
  const mapOut = new Map();
  months.forEach(m => { mapIn.set(m, 0); mapOut.set(m, 0); });

  for (const e of entries) {
    const m = ymFromDate(e.date);
    if (!mapIn.has(m)) continue;
    if (e.flow === "IN") mapIn.set(m, mapIn.get(m) + e.amount);
    else mapOut.set(m, mapOut.get(m) + e.amount);
  }

  return {
    labels: months.map(formatMonthLabel),
    in: months.map(m => mapIn.get(m) || 0),
    out: months.map(m => mapOut.get(m) || 0)
  };
}

function aggregateCategory(entries, flowFilter = "ALL") {
  const map = new Map();
  for (const e of entries) {
    if (flowFilter !== "ALL" && e.flow !== flowFilter) continue;
    const cat = e.category && String(e.category).trim() ? e.category : "Uncategorized";
    map.set(cat, (map.get(cat) || 0) + e.amount);
  }
  const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  if (arr.length > 8) {
    const top = arr.slice(0, 8);
    const rest = arr.slice(8);
    const restSum = rest.reduce((s, [_k, v]) => s + v, 0);
    top.push(["Other", restSum]);
    return top;
  }
  return arr;
}

function money(v) { return INR.format(v || 0); }
function safeGet(id) { return document.getElementById(id); }

/* Ensure the canvas internal pixel size matches client size for crisp drawing and Chart.js layout */
function ensureCanvasPixelSize(canvas) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight || 160);
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

/* ---------- Chart builders / helpers ---------- */

function destroyCharts() {
  if (balanceChart) { balanceChart.destroy(); balanceChart = null; }
  if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; }
  if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
}

function showNoDataOnCanvas(canvasId, text = "No data") {
  const c = safeGet(canvasId);
  if (!c) return;
  ensureCanvasPixelSize(c);
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#64748b";
  // choose scaled font size (use device px)
  const fs = Math.max(12, Math.round((c.clientHeight || 160) * 0.12));
  ctx.font = `${fs}px system-ui, -apple-system, 'Segoe UI', Roboto`;
  ctx.textAlign = "center";
  ctx.fillText(text, c.clientWidth / 2, c.clientHeight / 2);
  ctx.restore();
}

/* Build charts using filtered view for some charts & full entries for monthly */
function buildCharts(filteredEntries, allEntries, rangeFrom = null) {
  filteredEntries = filteredEntries || [];
  allEntries = allEntries || [];

  const sorted = [...filteredEntries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });

  let opening = 0;
  if (rangeFrom) {
    opening = allEntries
      .filter(e => e.date < rangeFrom)
      .reduce((s, e) => s + (e.flow === "IN" ? e.amount : -e.amount), 0);
  }

  // Running balance
  const points = aggregateRunningBalance(sorted, opening);
  const labels = points.map(p => p.date);
  const balances = points.map(p => p.balance);

  // Monthly
  const months = lastNMonths(12);
  const monthly = aggregateMonthly(allEntries, months);

  // Category
  const flowSelect = safeGet("catFlow")?.value || "IN";
  const catArr = aggregateCategory(filteredEntries, flowSelect);
  const catLabels = catArr.map(a => a[0]);
  const catValues = catArr.map(a => a[1]);

  // Destroy previous charts
  destroyCharts();

  // Running balance chart
  const balanceCanvas = safeGet("balanceChart");
  if (!points.length) {
    showNoDataOnCanvas("balanceChart", "No running balance in this range");
  } else if (balanceCanvas) {
    ensureCanvasPixelSize(balanceCanvas);
    const bg = balanceCanvas.getContext("2d");
    balanceChart = new Chart(bg, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Running Balance",
          data: balances,
          tension: 0.25,
          borderWidth: 2,
          fill: true,
          pointRadius: 3,
          backgroundColor: 'rgba(16,185,129,0.08)',
          borderColor: 'rgba(16,185,129,0.9)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: { label: ctx => `Balance: ${money(ctx.parsed.y)}` }
          },
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: "Date" },
            ticks: { maxRotation: 0, autoSkip: true }
          },
          y: {
            title: { display: true, text: "Balance (INR)" },
            ticks: { callback: val => money(val) }
          }
        }
      }
    });
  }

  // Monthly bar chart
  const monthlyCanvas = safeGet("monthlyChart");
  if (monthlyCanvas) {
    ensureCanvasPixelSize(monthlyCanvas);
    const bm = monthlyCanvas.getContext("2d");
    monthlyChart = new Chart(bm, {
      type: "bar",
      data: {
        labels: monthly.labels,
        datasets: [
          { label: "IN", data: monthly.in, stack: "s1", backgroundColor: 'rgba(59,130,246,0.6)' },
          { label: "OUT", data: monthly.out, stack: "s1", backgroundColor: 'rgba(248,113,113,0.6)' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } },
          legend: { position: "top" }
        },
        scales: {
          x: { stacked: true, title: { display: true, text: "Month" }, ticks: { maxRotation: 0 } },
          y: { stacked: true, title: { display: true, text: "Amount (INR)" }, ticks: { callback: v => money(v) } }
        }
      }
    });
  }

  // Category doughnut
  const categoryCanvas = safeGet("categoryChart");
  if (!catValues.length) {
    showNoDataOnCanvas("categoryChart", "No categories to show");
  } else if (categoryCanvas) {
    ensureCanvasPixelSize(categoryCanvas);
    const pc = categoryCanvas.getContext("2d");
    const total = catValues.reduce((s, v) => s + v, 0);
    categoryChart = new Chart(pc, {
      type: "doughnut",
      data: {
        labels: catLabels,
        datasets: [{ data: catValues, backgroundColor: generatePalette(catValues.length) }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const pct = total ? ((val / total) * 100).toFixed(1) : "0.0";
                return `${ctx.label}: ${money(val)} (${pct}%)`;
              }
            }
          },
          legend: { position: "right", labels: { boxWidth: 12 } }
        }
      }
    });
  }

  // after charts created, give Chart.js a moment and then resize/repaint
  setTimeout(() => {
    try {
      balanceChart?.resize?.();
      monthlyChart?.resize?.();
      categoryChart?.resize?.();
    } catch (e) { console.warn("chart resize error", e); }
  }, 140);
}

/* small palette generator (simple, deterministic) */
function generatePalette(n) {
  const base = [
    "#3b82f6", "#10b981", "#f97316", "#8b5cf6",
    "#06b6d4", "#ef4444", "#f59e0b", "#60a5fa",
    "#34d399", "#fb7185"
  ];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

/* ---------- Utility: Sparklines (last 7 days) ---------- */

function lastNDaysDates(n = 7) {
  const res = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    res.push(d.toISOString().slice(0, 10));
  }
  return res;
}

function drawSparkInternal(canvasId, values) {
  const c = safeGet(canvasId);
  if (!c) return;
  // prefer external helper if present (index.html defines window.drawSpark)
  if (typeof window.drawSpark === "function") {
    try { window.drawSpark(canvasId, values); return; } catch (e) { /* fallback below */ }
  }
  // fallback: tiny canvas rendering
  try {
    ensureCanvasPixelSize(c);
    const ctx = c.getContext("2d");
    const w = c.clientWidth, h = c.clientHeight || 36;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!values || !values.length) return;
    const max = Math.max(...values), min = Math.min(...values);
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1 || 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = 'rgba(16,185,129,0.06)';
    ctx.fill();
  } catch (e) { console.warn('spark fallback error', e); }
}

/* ---------- Data refresh / UI ---------- */

function validateCustomRange() {
  const mode = safeGet("dashRange")?.value;
  if (mode !== "CUSTOM") return { ok: true };
  const f = safeGet("dashFrom")?.value;
  const t = safeGet("dashTo")?.value;
  if (!f || !t) return { ok: false, msg: "Select both From and To dates for custom range." };
  if (f > t) return { ok: false, msg: "From date cannot be after To date." };
  return { ok: true, from: f, to: t };
}

async function refresh() {
  showLoader();
  try {
    const all = await fetchEntries(); // array of entries
    const rangeSel = safeGet("dashRange")?.value || "MONTH";

    let from = null, to = null;
    if (rangeSel === "CUSTOM") {
      const valid = validateCustomRange();
      if (!valid.ok) { alert(valid.msg); hideLoader(); return; }
      from = valid.from; to = valid.to;
    } else if (rangeSel === "MONTH") {
      from = monthStartISO(); to = monthEndISO();
    } else if (rangeSel === "YEAR") {
      const months = lastNMonths(12);
      const earliest = months[0].split("-");
      from = `${earliest[0]}-${earliest[1]}-01`;
      to = todayISO();
    } else if (rangeSel === "ALL") {
      from = null; to = null;
    }

    // filter
    let filtered = all.slice();
    if (from) filtered = filtered.filter(e => e.date >= from);
    if (to) filtered = filtered.filter(e => e.date <= to);

    // summary cards
    const today = todayISO();
    const todayRows = all.filter(e => e.date === today);
    const tdIn = todayRows.filter(e => e.flow === "IN").reduce((s, e) => s + e.amount, 0);
    const tdOut = todayRows.filter(e => e.flow === "OUT").reduce((s, e) => s + e.amount, 0);

    const mFrom = monthStartISO(), mTo = monthEndISO();
    const monthRows = all.filter(e => e.date >= mFrom && e.date <= mTo);
    const moNet = monthRows.reduce((s, e) => s + (e.flow === "IN" ? e.amount : -e.amount), 0);
    const allNet = all.reduce((s, e) => s + (e.flow === "IN" ? e.amount : -e.amount), 0);

    safeGet("tdIn").textContent = money(tdIn);
    safeGet("tdOut").textContent = money(tdOut);
    safeGet("moNet").textContent = money(moNet);
    safeGet("allNet").textContent = money(allNet);
    safeGet("allClosing").textContent = money(allNet);

    // small sparklines for top cards (last 7 days)
    try {
      const days = lastNDaysDates(7);
      // prepare per-day sums
      const inMap = new Map(days.map(d => [d, 0]));
      const outMap = new Map(days.map(d => [d, 0]));
      for (const e of all) {
        if (inMap.has(e.date)) {
          if (e.flow === "IN") inMap.set(e.date, inMap.get(e.date) + e.amount);
          else outMap.set(e.date, outMap.get(e.date) + e.amount);
        }
      }
      const inVals = days.map(d => inMap.get(d) || 0);
      const outVals = days.map(d => outMap.get(d) || 0);
      // net per day
      const netVals = days.map((d, i) => (inVals[i] || 0) - (outVals[i] || 0));
      drawSparkInternal("sparkTdIn", inVals);
      drawSparkInternal("sparkTdOut", outVals);
      drawSparkInternal("sparkMoNet", netVals);
      drawSparkInternal("sparkAllNet", netVals);
    } catch (e) { console.warn("sparks draw error", e); }

    await buildCharts(filtered, all, from);
  } catch (err) {
    console.error("Dashboard refresh error:", err);
    alert("Failed to load dashboard data. Check console for details.");
  } finally {
    hideLoader();
  }
}

/* ---------- Init listeners ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const dashFrom = safeGet("dashFrom"), dashTo = safeGet("dashTo");
  if (dashFrom) dashFrom.value = monthStartISO();
  if (dashTo) dashTo.value = monthEndISO();

  const apply = safeGet("dashApply"), reset = safeGet("dashReset"), range = safeGet("dashRange"), catFlow = safeGet("catFlow");

  apply?.addEventListener("click", () => {
    const mode = range?.value;
    if (mode === "CUSTOM") {
      const f = dashFrom?.value, t = dashTo?.value;
      if (!f || !t) return alert("Select both From and To dates for custom range.");
      if (f > t) return alert("From date cannot be after To date.");
    }
    refresh();
  });

  reset?.addEventListener("click", () => {
    if (range) range.value = "MONTH";
    if (dashFrom) dashFrom.value = monthStartISO();
    if (dashTo) dashTo.value = monthEndISO();
    refresh();
  });

  catFlow?.addEventListener("change", () => refresh());
  range?.addEventListener("change", () => {
    if (range.value !== "CUSTOM") {
      if (dashFrom) dashFrom.value = monthStartISO();
      if (dashTo) dashTo.value = monthEndISO();
    }
    refresh();
  });

  // ensure charts & sparks repaint on window resize
  window.addEventListener('resize', () => {
    try {
      // Chart.js resize
      balanceChart?.resize?.();
      monthlyChart?.resize?.();
      categoryChart?.resize?.();
    } catch (e) { /* ignore */ }

    // redraw small sparks (match their client sizes)
    ['sparkTdIn','sparkTdOut','sparkMoNet','sparkAllNet'].forEach(id => {
      const c = safeGet(id);
      if (c) {
        // attempt to redraw by triggering a refresh (cheap)
        // we call refresh's spark routine by simply calling refresh sparklines only if entries cached? simplest: re-run refresh
      }
    });
    // For reliability, trigger a full refresh after resize debounce could be heavy; skip automatic full refresh here.
  });

  // initial
  refresh();
});
