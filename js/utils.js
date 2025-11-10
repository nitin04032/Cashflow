export const INR = new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR" });
export const todayISO = () => new Date().toISOString().slice(0,10);
export const monthStartISO = (d=new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
export const monthEndISO = (d=new Date()) => new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);

export function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric" });
}
export function computeOpeningBalance(entries, from){
  if (!from) return 0;
  return entries
    .filter(e => e.date < from)
    .reduce((bal,e) => bal + (e.type === "IN" ? Number(e.amount) : -Number(e.amount)), 0);
}
export function computeTotals(entries){
  const totalIn  = entries.filter(e=>e.type==="IN").reduce((s,e)=>s+Number(e.amount),0);
  const totalOut = entries.filter(e=>e.type==="OUT").reduce((s,e)=>s+Number(e.amount),0);
  return { totalIn, totalOut, net: totalIn - totalOut };
}
export function sortAscForBalance(rows){
  return [...rows].sort((a,b)=> (a.date > b.date ? 1 : a.date < b.date ? -1 : a.id - b.id));
}

// Filter helpers via URL params
export function getFilterFromURL() {
  const p = new URLSearchParams(location.search);
  const mode = p.get("mode") || "ALL"; // ALL | TODAY | MONTH | CUSTOM
  const from = p.get("from");
  const to   = p.get("to");
  return { mode, from, to };
}
export function setFilterLabel(el, {mode,from,to}) {
  if (mode === "TODAY") el.textContent = `Showing: Today (${todayISO()})`;
  else if (mode === "MONTH") el.textContent = `Showing: This Month (${monthStartISO()} to ${monthEndISO()})`;
  else if (mode === "CUSTOM" && from && to) el.textContent = `Showing: ${from} to ${to}`;
  else el.textContent = "Showing: All";
}
export function deriveRange({mode,from,to}){
  if (mode === "TODAY") return { from: todayISO(), to: todayISO() };
  if (mode === "MONTH") return { from: monthStartISO(), to: monthEndISO() };
  if (mode === "CUSTOM") return { from, to };
  return { from:null, to:null };
}
export function inRange(iso, from, to){
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}
export function buildPrintURL(filter){
  const p = new URLSearchParams();
  if (filter.mode) p.set("mode", filter.mode);
  if (filter.from) p.set("from", filter.from);
  if (filter.to)   p.set("to", filter.to);
  return `print.html?${p.toString()}`;
}
