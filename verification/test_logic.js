
function ymFromDate(d) {
  // if we already have a YYYY-MM-DD string, use it directly to avoid timezone shifting
  if (typeof d === "string" && /^\d{4}-\d{2}/.test(d)) {
    return d.slice(0, 7);
  }
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

// Test cases
const tests = [
    { input: "2023-10-01", expected: "2023-10" },
    { input: "2023-01-15T00:00:00.000Z", expected: "2023-01" }, // Regex matches YYYY-MM
    { input: "10/01/2023", expected: "2023-10" }, // Falls back to Date parsing
    { input: new Date("2023-12-25"), expected: "2023-12" } // Date object
];

let failed = false;
tests.forEach(({input, expected}) => {
    let output;
    try {
        output = ymFromDate(input);
    } catch (e) {
        output = "ERROR";
    }
    if (output !== expected) {
        console.log(`FAIL: Input ${input} -> Expected ${expected}, got ${output}`);
        // Note: "10/01/2023" might fail if local timezone and UTC date parsing differs, but for this test we assume standard behavior.
        // Actually "10/01/2023" is not ISO, so Date() parses it in local time usually, or browser dependent.
        // But the main fix is for YYYY-MM-DD strings.
    } else {
        console.log(`PASS: Input ${input}`);
    }
});
