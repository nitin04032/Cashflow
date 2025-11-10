// LocalStorage + CSV helpers
export const storageKey = "cash_entries_v3"; // bumped version for new 'party' field

export function loadEntries() {
  try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
}
export function saveEntries(entries) { localStorage.setItem(storageKey, JSON.stringify(entries)); }

// CSV columns now include 'party'
export function toCSV(entries) {
  const header = ["id","date","flow","amount","person","party","mode","category","remarks"];
  const lines = [header.join(",")];
  for (const e of entries) {
    const row = [
      e.id,
      e.date,
      e.flow, // IN | OUT
      e.amount,
      csvSafe(e.person || ""),
      csvSafe(e.party || ""),
      e.mode || "",
      csvSafe(e.category || ""),
      csvSafe(e.remarks || ""),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}
function csvSafe(s) {
  if (!s) return "";
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g,'""')}"`;
  return s;
}
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",");
  const out = [];
  for (let i=1;i<lines.length;i++){
    const cells = splitCSVLine(lines[i]);
    const row = Object.fromEntries(header.map((h,idx)=>[h,cells[idx] ?? ""]));
    out.push({
      id: Number(row.id) || Date.now()+i,
      date: row.date || todayISO(),
      flow: row.flow === "OUT" ? "OUT" : "IN",
      amount: String(row.amount || "0"),
      person: row.person || "",
      party: row.party || "",
      mode: row.mode || "Cash",
      category: row.category || "Other",
      remarks: row.remarks || "",
    });
  }
  return out;
}
function splitCSVLine(line){
  const result=[]; let current=""; let inQuotes=false;
  for (let i=0;i<line.length;i++){
    const ch=line[i];
    if (inQuotes){
      if (ch === '"' && line[i+1] === '"'){ current+='"'; i++; }
      else if (ch === '"'){ inQuotes=false; }
      else { current+=ch; }
    } else {
      if (ch === ","){ result.push(current); current=""; }
      else if (ch === '"'){ inQuotes=true; }
      else { current+=ch; }
    }
  }
  result.push(current);
  return result;
}

// small util (used above)
export const todayISO = () => new Date().toISOString().slice(0,10);
