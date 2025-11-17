import { todayISO } from "./utils.js";
import { saveEntry, uploadReceipt } from "./api.js";
import { showLoader, hideLoader } from "./loader.js";

// --- local storage keys
const DRAFT_KEY = "cf_add_draft_v1";
const PERSONS_KEY = "cf_persons_v1";
const PARTIES_KEY = "cf_parties_v1";
const TEMPLATES_KEY = "cf_templates_v1";

// --- categories (same as before; you can populate datalist)
const OUT_CATEGORIES = ["Bills Entry","Supplier Payment","Salaries","EMI","Daily Expenses","Tax Entry","Ads & Marketing","Cash Out Entry","Other"];
const IN_CATEGORIES  = ["Entry Bills","Received from B2C","Received from B2B","Cash Entry","Sales (Inflow)","Customer Payment","Refund Received","Investment / Capital","Loan Received","Other"];

// element refs
const form = document.getElementById("entryForm");
const dateEl = document.getElementById("date");
const flowEl = document.getElementById("flow");
const amountEl = document.getElementById("amount");
const personEl = document.getElementById("person");
const partyEl = document.getElementById("party");
const modeEl = document.getElementById("mode");
const firmEl = document.getElementById("firm");
const firmWrapper = document.getElementById("firmWrapper");
const categoryEl = document.getElementById("category");
const remarksEl = document.getElementById("remarks");
const receiptEl = document.getElementById("receipt");
const previewEl = document.getElementById("receiptPreview");
const amountWordsEl = document.getElementById("amountWords");
const saveBtn = document.getElementById("saveBtn");
const templatesList = document.getElementById("templatesList");

// helpers: toast
function toast(message, opts={}) {
  const root = document.getElementById("toast");
  root.innerHTML = `<div class="msg ${opts.type==="error"?"error":""}">${message}</div>`;
  root.style.opacity = "1";
  setTimeout(()=>{ root.innerHTML=""; }, opts.timeout || 4200);
}

// simple amount to words (INR) - supports up to crores. Light implementation.
function toWords(num) {
  if (!num && num !== 0) return "";
  num = Number(num);
  if (!isFinite(num)) return "";
  const ones = ["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  function w(n){
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)] + " hundred" + (n%100 ? " " + w(n%100) : "");
    return "";
  }
  const crore = Math.floor(num/10000000);
  const lakh = Math.floor((num%10000000)/100000);
  const thousand = Math.floor((num%100000)/1000);
  const remainder = Math.floor(num%1000);
  let parts = [];
  if (crore) parts.push(w(crore) + " crore");
  if (lakh) parts.push(w(lakh) + " lakh");
  if (thousand) parts.push(w(thousand) + " thousand");
  if (remainder) parts.push(w(remainder));
  let rupees = parts.join(" ");
  let paise = Math.round((num - Math.floor(num)) * 100);
  let s = rupees ? rupees + " rupees" : "";
  if (paise) s += (s ? " and " : "") + w(paise) + " paise";
  return s || "zero rupees";
}

// populate datalists
function populateDatalists(){
  const catList = document.getElementById("categories");
  const list = (flowEl.value === "OUT") ? OUT_CATEGORIES : IN_CATEGORIES;
  catList.innerHTML = list.map(c => `<option value="${c}"></option>`).join("");

  const persons = JSON.parse(localStorage.getItem(PERSONS_KEY) || "[]");
  const parties = JSON.parse(localStorage.getItem(PARTIES_KEY) || "[]");
  document.getElementById("persons").innerHTML = persons.map(p=>`<option value="${p}"></option>`).join("");
  document.getElementById("parties").innerHTML = parties.map(p=>`<option value="${p}"></option>`).join("");
}

// templates management
function loadTemplates(){
  const t = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
  templatesList.innerHTML = t.length ? t.map((temp, idx) =>
    `<button data-idx="${idx}">${temp.flow} • ${temp.category} • ${temp.amount} <small class="muted">— ${temp.person || ''} ${temp.party? '/ '+temp.party : ''}</small></button>`
  ).join("") : "No templates";
  // attach handlers
  templatesList.querySelectorAll("button[data-idx]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.getAttribute("data-idx"));
      applyTemplate(idx);
    });
  });
}
function saveTemplate(){
  const t = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
  const tpl = {
    flow: flowEl.value,
    amount: amountEl.value,
    person: personEl.value,
    party: partyEl.value,
    mode: modeEl.value,
    firm: firmEl.value,
    category: categoryEl.value,
    remarks: remarksEl.value
  };
  t.unshift(tpl);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t.slice(0,20)));
  loadTemplates();
  toast("Template saved");
}
function applyTemplate(idx){
  const t = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
  const tpl = t[idx];
  if (!tpl) return;
  flowEl.value = tpl.flow || "IN";
  amountEl.value = tpl.amount || "";
  personEl.value = tpl.person || "";
  partyEl.value = tpl.party || "";
  modeEl.value = tpl.mode || "Cash";
  firmEl.value = tpl.firm || "";
  categoryEl.value = tpl.category || "";
  remarksEl.value = tpl.remarks || "";
  populateDatalists();
  handleModeVisibility();
  updateAmountWords();
  toast("Template applied");
}

// autosave / draft
function saveDraft(){
  const draft = {
    date: dateEl.value,
    flow: flowEl.value,
    amount: amountEl.value,
    person: personEl.value,
    party: partyEl.value,
    mode: modeEl.value,
    firm: firmEl.value,
    category: categoryEl.value,
    remarks: remarksEl.value
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
function loadDraft(){
  const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  if (!d) return;
  dateEl.value = d.date || todayISO();
  flowEl.value = d.flow || "IN";
  amountEl.value = d.amount || "";
  personEl.value = d.person || "";
  partyEl.value = d.party || "";
  modeEl.value = d.mode || "Cash";
  firmEl.value = d.firm || "";
  categoryEl.value = d.category || "";
  remarksEl.value = d.remarks || "";
}

// maintain recent persons/parties
function addRecentPerson(name){
  if (!name) return;
  const arr = JSON.parse(localStorage.getItem(PERSONS_KEY) || "[]");
  const idx = arr.indexOf(name);
  if (idx !== -1) arr.splice(idx,1);
  arr.unshift(name);
  localStorage.setItem(PERSONS_KEY, JSON.stringify(arr.slice(0,20)));
}
function addRecentParty(name){
  if (!name) return;
  const arr = JSON.parse(localStorage.getItem(PARTIES_KEY) || "[]");
  const idx = arr.indexOf(name);
  if (idx !== -1) arr.splice(idx,1);
  arr.unshift(name);
  localStorage.setItem(PARTIES_KEY, JSON.stringify(arr.slice(0,20)));
}

// receipt preview
function showReceiptPreview(file){
  if (!file) { previewEl.textContent = "No file chosen"; return; }
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    previewEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:140px;border-radius:6px" />`;
  } else {
    previewEl.textContent = file.name;
  }
}

// validation
function validateForm(){
  const errors = [];
  const amt = parseFloat(amountEl.value || "0");
  if (!dateEl.value) errors.push("Date required");
  if (!(amt > 0)) errors.push("Amount must be > 0");
  if (!categoryEl.value) errors.push("Select a category");
  // optional: if mode is Online and firm is visible, you can require firm selection
  if (modeEl.value === 'Online' && firmWrapper.style.display !== 'none' && !firmEl.value) {
    // comment out the next line if you don't want firm to be mandatory
    // errors.push("Select firm for Online payments");
  }
  return errors;
}

// show/hide firm field based on mode
function handleModeVisibility(){
  if (modeEl.value === 'Online'){
    firmWrapper.style.display = '';
  } else {
    firmWrapper.style.display = 'none';
    firmEl.value = '';
  }
}

// --- events
document.addEventListener("DOMContentLoaded", () => {
  dateEl.value = todayISO();
  populateDatalists();
  loadDraft();
  loadTemplates();
  updateAmountWords();
  handleModeVisibility();

  // update categories when flow changes
  flowEl.addEventListener("change", () => {
    populateDatalists();
  });

  // mode change shows/hides firm
  modeEl.addEventListener("change", () => {
    handleModeVisibility();
    saveDraft();
  });

  // autosave
  [dateEl, flowEl, amountEl, personEl, partyEl, modeEl, firmEl, categoryEl, remarksEl].forEach(el=>{
    el.addEventListener("input", () => { saveDraft(); updateAmountWords(); });
  });

  // template save
  document.getElementById("saveTemplate").addEventListener("click", saveTemplate);
  document.getElementById("clearDraft").addEventListener("click", () => {
    if (!confirm("Clear draft?")) return;
    localStorage.removeItem(DRAFT_KEY);
    loadDraft();
    toast("Draft cleared");
  });

  // receipt change
  receiptEl.addEventListener("change", (e)=>{
    showReceiptPreview(e.target.files[0]);
    saveDraft();
  });

  // keyboard shortcuts
  document.addEventListener("keydown", (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
    if (e.key === "Escape") {
      if (confirm("Clear form?")) {
        form.reset();
        localStorage.removeItem(DRAFT_KEY);
        showReceiptPreview(null);
      }
    }
  });

  // amount words live
  amountEl.addEventListener("input", updateAmountWords);

  // submit handler
  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();

    const errs = validateForm();
    if (errs.length) {
      toast(errs.join(", "), { type: "error" });
      return;
    }

    // build entry
    const date = dateEl.value || todayISO();
    const flow = flowEl.value;
    const amount = parseFloat(amountEl.value).toFixed(2);
    const person = personEl.value.trim();
    const party = partyEl.value.trim();
    const mode = modeEl.value;
    const firm = firmEl.value || null;
    const category = categoryEl.value;
    const remarks = remarksEl.value.trim();

    // disable submit
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    showLoader();

    let receiptUrl = null;
    const file = receiptEl.files?.[0];
    if (file) {
      const up = await uploadReceipt(file);
      if (up && up.success) {
        receiptUrl = up.url;
      } else {
        // optional: continue without receipt or abort
        toast("Receipt upload failed: " + (up.message || "error"), { type:"error" });
      }
    }

    const newEntry = {
      date,
      flow,
      amount,
      person,
      party,
      mode,
      firm,
      category,
      remarks,
      receipt_url: receiptUrl
    };

    // Save entry via Supabase (saveEntry should accept receipt_url and firm)
    const result = await saveEntry(newEntry);

    hideLoader();
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Entry";

    if (result && result.success) {
      // add to recents
      addRecentPerson(person);
      addRecentParty(party);
      populateDatalists();

      // clear form & draft
      localStorage.removeItem(DRAFT_KEY);
      form.reset();
      dateEl.value = todayISO();
      showReceiptPreview(null);
      updateAmountWords();
      handleModeVisibility();

      toast("Saved successfully");
    } else {
      toast("Failed to save entry. Try again.", { type: "error" });
    }
  });
});

// utility: update amount words display
function updateAmountWords(){
  const val = amountEl.value;
  if (!val) { amountWordsEl.textContent = ""; return; }
  amountWordsEl.textContent = toWords(val);
}
