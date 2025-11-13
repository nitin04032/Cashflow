// js/api.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, RECEIPTS_BUCKET } from "./config.js";

// Ensure supabase client is available (you already include CDN in HTML)
if (!window?.supabase?.createClient) {
  console.error("Supabase CDN not loaded. Add script: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
  throw new Error("Supabase CDN not loaded");
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Utilities ----------
function isoDateString(val) {
  if (!val) return null;
  if (typeof val === "string") return val.slice(0, 10);
  return new Date(val).toISOString().slice(0, 10);
}

function csvSafe(s) {
  if (!s) return "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- Storage: uploadReceipt ----------
export async function uploadReceipt(file) {
  if (!file) return { success: false, message: "No file" };
  try {
    const ts = Date.now();
    const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\.\-]/g, "");
    const path = `${ts}_${safeName}`;

    const max = 5 * 1024 * 1024;
    if (file.size > max) return { success: false, message: "File too large (max 5MB)" };

    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) throw error;

    const { data: publicData } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || null;

    return { success: true, url: publicUrl };
  } catch (err) {
    console.error("uploadReceipt error", err);
    return { success: false, message: err?.message || "Upload failed" };
  }
}

// ---------- Database helpers ----------
export async function fetchEntries() {
  try {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("date", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;
    return (data || []).map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
      id: Number(entry.id),
      date: (entry.date || "").toString().slice(0, 10),
    }));
  } catch (error) {
    console.error("Error fetching entries from Supabase:", error);
    alert("Error fetching entries from Supabase. Check console for details.");
    return [];
  }
}

/**
 * Save entry to 'entries' table.
 * Automatically attaches user_id if user is signed in.
 * Returns { success:true, id } or { success:false, error }
 */
export async function saveEntry(entry) {
  try {
    // get current authenticated user (if any)
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id ?? null;

    const payload = {
      date: isoDateString(entry.date),
      flow: entry.flow,
      amount: Number(entry.amount),
      person: entry.person || null,
      party: entry.party || null,
      mode: entry.mode || null,
      category: entry.category || null,
      remarks: entry.remarks || null,
      receipt_url: entry.receipt_url || null,
      user_id: userId
    };

    const { data, error } = await supabase.from("entries").insert([payload]).select().single();
    if (error) throw error;
    return { success: true, id: data?.id ?? null };
  } catch (error) {
    console.error("Error saving entry to Supabase:", error);
    alert("Failed to save entry. Check server connection.");
    return { success: false, error: error?.message || "Save failed" };
  }
}

/**
 * Update entry by id (requires either RLS allowing the user
 * to update their own rows or you run this with appropriate privileges)
 * payload: fields to update (partial)
 */
export async function updateEntry(id, payload) {
  try {
    // ensure date formatting if present
    if (payload.date) payload.date = isoDateString(payload.date);
    const { data, error } = await supabase.from("entries").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("updateEntry error", error);
    return { success: false, error: error?.message || "Update failed" };
  }
}

export async function deleteEntry(id) {
  try {
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting entry from Supabase:", error);
    alert("Failed to delete entry. Check connection.");
    return false;
  }
}

// CSV export
export function toCSV(entries) {
  const header = ["id", "date", "flow", "amount", "person", "party", "mode", "category", "remarks", "receipt_url", "user_id"];
  const lines = [header.join(",")];
  for (const e of entries) {
    const row = [
      e.id,
      e.date,
      e.flow,
      e.amount,
      csvSafe(e.person || ""),
      csvSafe(e.party || ""),
      e.mode || "",
      csvSafe(e.category || ""),
      csvSafe(e.remarks || ""),
      e.receipt_url || "",
      e.user_id || ""
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}
