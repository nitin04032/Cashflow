import { todayISO } from "./utils.js";
import { loadEntries, saveEntries } from "./storage.js";

// OUT categories unchanged
const OUT_CATEGORIES = [
  "Bills Entry",
  "Supplier Payment",
  "Salaries",
  "EMI",
  "Daily Expenses",
  "Tax Entry",
  "Ads & Marketing",
  "Cash Out Entry",
  "Other",
];

// IN categories — added your requested types first
const IN_CATEGORIES = [
  "Entry Bills",             // your request
  "Received from B2C",       // your request
  "Received from B2B",       // your request
  "Cash Entry",              // your request
  "Sales (Inflow)",
  "Customer Payment",
  "Refund Received",
  "Investment / Capital",
  "Loan Received",
  "Other",
];

function populateCategory(flow) {
  const sel = document.getElementById("category");
  const list = flow === "OUT" ? OUT_CATEGORIES : IN_CATEGORIES;
  sel.innerHTML = list.map(v => `<option>${v}</option>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("date").value = todayISO();

  // ensure category options match initial flow
  populateCategory(document.getElementById("flow").value || "IN");

  // when flow changes, swap categories
  document.getElementById("flow").addEventListener("change", (e) => {
    populateCategory(e.target.value);
  });

  document.getElementById("entryForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const date = document.getElementById("date").value || todayISO();
    const flow = document.getElementById("flow").value; // IN or OUT
    const amount = parseFloat(document.getElementById("amount").value || "0");
    const person = document.getElementById("person").value.trim();
    const party  = document.getElementById("party").value.trim(); // NEW
    const mode = document.getElementById("mode").value;
    const category = document.getElementById("category").value;
    const remarks = document.getElementById("remarks").value.trim();

    if (!amount || amount <= 0) { alert("Amount must be greater than 0"); return; }

    const entries = loadEntries();
    entries.push({
      id: Date.now(),
      date,
      flow: flow === "OUT" ? "OUT" : "IN",
      amount: amount.toFixed(2),
      person,
      party,   // NEW
      mode,
      category,
      remarks,
    });
    saveEntries(entries);

    // reset some fields
    document.getElementById("amount").value = "";
    document.getElementById("person").value = "";
    document.getElementById("party").value = "";   // NEW
    document.getElementById("remarks").value = "";

    alert("Saved!");
  });
});
