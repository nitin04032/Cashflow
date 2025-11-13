// js/dashboard.js
import { INR, todayISO, monthStartISO, monthEndISO } from "./utils.js";
import { fetchEntries } from "./api.js";
import { showLoader, hideLoader } from "./loader.js";

let balanceChart, monthlyChart, categoryChart;

// Helper: format YYYY-MM for month buckets
function ymFromDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
}

// Helper: last N months array (YYYY-MM)
function lastNMonths(n=12) {
  const arr = [];
  const now = new Date();
  for (let i=n-1;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  return arr;
}

function aggregateRunningBalance(sortedEntries, opening = 0) {
  // sortedEntries must be sorted by date asc then id asc
  const points = [];
  let running = opening;
  for (const e of sortedEntries) {
    running += (e.flow === "IN" ? e.amount : -e.amount);
    points.push({ date: e.date, balance: running });
  }
  return points;
}

function aggregateMonthly(entries, months) {
  // returns { labels: [...], in: [...], out: [...] }
  const mapIn = new Map();
  const mapOut = new Map();
  months.forEach(m => { mapIn.set(m,0); mapOut.set(m,0); });

  for (const e of entries) {
    const m = ymFromDate(e.date);
    if (!mapIn.has(m)) continue; // ignore out-of-range months
    if (e.flow === "IN") mapIn.set(m, mapIn.get(m) + e.amount);
    else mapOut.set(m, mapOut.get(m) + e.amount);
  }
  return {
    labels: months,
    in: months.map(m => mapIn.get(m) || 0),
    out: months.map(m => mapOut.get(m) || 0)
  };
}

function aggregateCategory(entries, flowFilter="ALL") {
  const map = new Map();
  for (const e of entries) {
    if (flowFilter !== "ALL" && e.flow !== flowFilter) continue;
    const cat = e.category || "Uncategorized";
    map.set(cat, (map.get(cat) || 0) + e.amount);
  }
  // sort descending
  const arr = Array.from(map.entries()).sort((a,b)=> b[1]-a[1]);
  // if too many categories, keep top 8 and group rest into "Other"
  if (arr.length > 8) {
    const top = arr.slice(0,8);
    const rest = arr.slice(8);
    const restSum = rest.reduce((s,[_k,v])=> s+v, 0);
    top.push(["Other", restSum]);
    return top;
  }
  return arr;
}

function money(v){ return INR.format(v); }

async function buildCharts(filteredEntries, allEntries, rangeFrom=null) {
  // sort asc for running balance
  const sorted = [...filteredEntries].sort((a,b)=> a.date > b.date ? 1 : a.date < b.date ? -1 : a.id - b.id);

  // compute opening balance (entries before rangeFrom)
  let opening = 0;
  if (rangeFrom) {
    opening = allEntries
      .filter(e => e.date < rangeFrom)
      .reduce((s,e)=> s + (e.flow === "IN" ? e.amount : -e.amount), 0);
  } else {
    // if no from, opening = 0
    opening = 0;
  }

  // Running balance points
  const points = aggregateRunningBalance(sorted, opening);
  const labels = points.map(p => p.date);
  const balances = points.map(p => p.balance);

  // Monthly last 12 months
  const months = lastNMonths(12);
  const monthly = aggregateMonthly(allEntries, months); // uses allEntries so months show even if zero

  // Category breakdown (use currently selected flow)
  const flowSelect = document.getElementById("catFlow")?.value || "IN";
  const catArr = aggregateCategory(filteredEntries, flowSelect);

  // Destroy existing charts if present
  if (balanceChart) { balanceChart.destroy(); balanceChart = null; }
  if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; }
  if (categoryChart) { categoryChart.destroy(); categoryChart = null; }

  // Balance line chart
  const bg = document.getElementById("balanceChart").getContext("2d");
  balanceChart = new Chart(bg, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Running Balance',
        data: balances,
        tension: 0.3,
        borderWidth: 2,
        fill: true,
        pointRadius: 3,
        // colors will follow default theme; Chart.js auto chooses
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `Balance: ${money(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Balance (INR)' }, ticks: { callback: val => money(val) } }
      }
    }
  });

  // Monthly bar chart
  const bm = document.getElementById("monthlyChart").getContext("2d");
  monthlyChart = new Chart(bm, {
    type: 'bar',
    data: {
      labels: monthly.labels,
      datasets: [
        { label: 'IN', data: monthly.in, stack: 'stack1' },
        { label: 'OUT', data: monthly.out, stack: 'stack1' }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${money(ctx.parsed.y)}`
          }
        },
        legend: { position: 'top' }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Month' } },
        y: { stacked: true, title: { display: true, text: 'Amount (INR)' }, ticks: { callback: v => money(v) } }
      }
    }
  });

  // Category pie/doughnut
  const pc = document.getElementById("categoryChart").getContext("2d");
  const catLabels = catArr.map(a=>a[0]);
  const catValues = catArr.map(a=>a[1]);
  categoryChart = new Chart(pc, {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{ data: catValues }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${money(ctx.parsed)} (${((ctx.parsed / catValues.reduce((s,v)=>s+v,0))*100).toFixed(1)}%)`
          }
        },
        legend: { position: 'right' }
      }
    }
  });
}

function deriveDatesFromRangeMode(mode) {
  const today = new Date();
  if (mode === "MONTH") return { from: monthStartISO(), to: monthEndISO() };
  if (mode === "YEAR") {
    const months = lastNMonths(12);
    return { from: months[0]+"-01".slice(0,0), to: todayISO() }; // we'll instead just treat YEAR as last 12 months using monthly labels
  }
  if (mode === "ALL") return { from: null, to: null };
  return { from: null, to: null };
}

async function refresh() {
  showLoader();
  try {
    const all = await fetchEntries();
    // default range = THIS MONTH
    const rangeSel = document.getElementById("dashRange")?.value || "MONTH";
    let from = null, to = null;
    if (rangeSel === "CUSTOM") {
      from = document.getElementById("dashFrom").value || null;
      to = document.getElementById("dashTo").value || null;
    } else if (rangeSel === "MONTH") {
      from = monthStartISO(); to = monthEndISO();
    } else if (rangeSel === "YEAR") {
      // We'll show last 12 months — but for filtered entries, pick entries within last 12 months
      const months = lastNMonths(12);
      from = months[0] + "-01".slice(0,0); // no-op; we'll compute filter below
      // Instead compute from date as first day of earliest month:
      const earliest = months[0].split("-");
      from = `${earliest[0]}-${earliest[1]}-01`;
      to = todayISO();
    } else {
      from = null; to = null;
    }

    // Filter entries by from/to if present
    let filtered = all;
    if (from) filtered = filtered.filter(e => e.date >= from);
    if (to) filtered = filtered.filter(e => e.date <= to);

    // Update top summary cards
    const today = todayISO();
    const todayRows = all.filter(e => e.date === today);
    const tdIn = todayRows.filter(e=>e.flow==="IN").reduce((s,e)=>s+e.amount,0);
    const tdOut = todayRows.filter(e=>e.flow==="OUT").reduce((s,e)=>s+e.amount,0);

    const mFrom = monthStartISO(), mTo = monthEndISO();
    const monthRows = all.filter(e => e.date >= mFrom && e.date <= mTo);
    const moNet = monthRows.reduce((s,e)=> s + (e.flow==="IN"? e.amount : -e.amount), 0);

    const allNet = all.reduce((s,e)=> s + (e.flow==="IN"? e.amount : -e.amount), 0);

    document.getElementById("tdIn").textContent = INR.format(tdIn);
    document.getElementById("tdOut").textContent = INR.format(tdOut);
    document.getElementById("moNet").textContent = INR.format(moNet);
    document.getElementById("allNet").textContent = INR.format(allNet);
    document.getElementById("allClosing").textContent = INR.format(allNet);

    // Build charts using filtered view for some charts & all entries for monthly chart (so months still show)
    await buildCharts(filtered, all, from);
  } catch (err) {
    console.error(err);
    alert("Failed to load dashboard data. Check console.");
  } finally {
    hideLoader();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // initialize date inputs to this month
  document.getElementById("dashFrom").value = monthStartISO();
  document.getElementById("dashTo").value = monthEndISO();

  document.getElementById("dashApply").addEventListener("click", () => {
    // If custom selected but missing dates, warn
    const mode = document.getElementById("dashRange").value;
    if (mode === "CUSTOM") {
      const f = document.getElementById("dashFrom").value;
      const t = document.getElementById("dashTo").value;
      if (!f || !t) return alert("Select both From and To dates for custom range.");
      if (f > t) return alert("From date cannot be after To date.");
    }
    refresh();
  });
  document.getElementById("dashReset").addEventListener("click", () => {
    document.getElementById("dashRange").value = "MONTH";
    document.getElementById("dashFrom").value = monthStartISO();
    document.getElementById("dashTo").value = monthEndISO();
    refresh();
  });

  // update charts when category flow toggles
  document.getElementById("catFlow").addEventListener("change", () => {
    refresh();
  });

  // start
  refresh();
});
 