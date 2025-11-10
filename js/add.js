import { todayISO } from "./utils.js";
import { loadEntries, saveEntries } from "./storage.js";

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
const IN_CATEGORIES = [
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
  // defaults
  document.getElementById("date").value = todayISO();
  populateCategory(document.getElementById("flow").value || "IN");

  // when flow changes, swap categories
  document.getElementById("flow").addEventListener("change", (e) => {
    populateCategory(e.target.value);
  });

  // save entry
  document.getElementById("entryForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const date = document.getElementById("date").value || todayISO();
    const flow = document.getElementById("flow").value; // IN or OUT
    const amount = parseFloat(document.getElementById("amount").value || "0");
    const person = document.getElementById("person").value.trim();
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
      mode,
      category,
      remarks,
    });
    saveEntries(entries);

    // reset some fields
    document.getElementById("amount").value = "";
    document.getElementById("person").value = "";
    document.getElementById("remarks").value = "";

    alert("Saved!");
  });
});
