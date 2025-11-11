// js/api.js

const API_ENDPOINT = 'api/entries.php'; // XAMPP सर्वर पर आपका PHP स्क्रिप्ट

/**
 * सभी entries को सर्वर से Fetch करता है।
 * @returns {Promise<Array>} entries की एक array.
 */
export async function fetchEntries() {
  try {
    const response = await fetch(`${API_ENDPOINT}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // सुनिश्चित करें कि amount number के रूप में parse हो जाए
    return data.map(entry => ({
      ...entry,
      amount: Number(entry.amount),
      id: Number(entry.id) // id को number के रूप में रखें
    }));
  } catch (error) {
    console.error("Error fetching entries:", error);
    alert("Error fetching entries from server!");
    return [];
  }
}

/**
 * सर्वर पर एक नई entry save करता है।
 * @param {object} entry - नई entry object.
 * @returns {Promise<boolean>} सफलता (true) या विफलता (false).
 */
export async function saveEntry(entry) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const result = await response.json();
    if (result.success) {
      return true;
    } else {
      throw new Error(result.message || "Failed to save entry.");
    }
  } catch (error) {
    console.error("Error saving entry:", error);
    alert("Failed to save entry. Check server connection.");
    return false;
  }
}

/**
 * सर्वर से एक entry delete करता है।
 * @param {number} id - delete करने के लिए entry की ID.
 * @returns {Promise<boolean>} सफलता (true) या विफलता (false).
 */
export async function deleteEntry(id) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (result.success) {
      return true;
    } else {
      throw new Error(result.message || "Failed to delete entry.");
    }
  } catch (error) {
    console.error("Error deleting entry:", error);
    alert("Failed to delete entry. Check server connection.");
    return false;
  }
}

// CSV functions now handle server-side data structure
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

// NOTE: Import functionality needs a server endpoint to handle merge logic.
// For simplicity, we are keeping local CSV parsing here, but saving would need to POST to the server.
// The parseCSV function from the original storage.js will be kept here but updated to use API save.
// For now, let's keep it simple: import is disabled unless you provide a server merge endpoint.
// We will only export toCSV.