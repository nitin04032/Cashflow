// verification/reproduce_bug.js
function ymFromDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

const dateStr = "2023-10-01";
console.log(`Input: ${dateStr}`);
console.log(`Output: ${ymFromDate(dateStr)}`);
console.log(`Expected: 2023-10`);

if (ymFromDate(dateStr) !== "2023-10") {
    console.log("FAIL: Output matches expectations for timezone behind UTC");
} else {
    console.log("PASS: Output matches expectation (likely running in UTC or ahead)");
}
