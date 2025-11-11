import { todayISO } from "./utils.js";
import { saveEntry } from "./api.js"; // Updated to use saveEntry from new API

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
  "Entry Bills",
  "Received from B2C",
  "Received from B2B",
  "Cash Entry",
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

  document.getElementById("entryForm").addEventListener("submit", async (e) => { // Made async
    e.preventDefault();

    const date = document.getElementById("date").value || todayISO();
    const flow = document.getElementById("flow").value; // IN or OUT
    const amount = parseFloat(document.getElementById("amount").value || "0");
    const person = document.getElementById("person").value.trim();
    const party  = document.getElementById("party").value.trim();
    const mode = document.getElementById("mode").value;
    const category = document.getElementById("category").value;
    const remarks = document.getElementById("remarks").value.trim();

    if (!amount || amount <= 0) { alert("Amount must be greater than 0"); return; }
    
    // Disable submit button during fetch
    const submitBtn = document.querySelector("#entryForm button[type='submit']");
    submitBtn.disabled = true;

    const newEntry = {
      // NOTE: We rely on the server (MySQL) to generate the ID
      // id: Date.now(), // No longer needed for new entries
      date,
      flow: flow === "OUT" ? "OUT" : "IN",
      amount: amount.toFixed(2), // Send as string for DB precision
      person,
      party,
      mode,
      category,
      remarks,
    };
    
    const saved = await saveEntry(newEntry); // Use new API function

    // Re-enable button
    submitBtn.disabled = false;

    if (saved) {
      // reset fields
      document.getElementById("amount").value = "";
      document.getElementById("person").value = "";
      document.getElementById("party").value = "";
      document.getElementById("remarks").value = "";

      alert("Saved successfully to MySQL!");
    } else {
        // Error alert is handled inside saveEntry, but an extra check can be here
        alert("Failed to save entry. Please try again.");
    }
  });
});