// verification/verify_fix.js
const { ymFromDate } = require('../js/dashboard_testable.js');

const dateStr = "2023-10-01";
console.log(`Input: ${dateStr}`);
const result = ymFromDate(dateStr);
console.log(`Output: ${result}`);
const expected = "2023-10";
console.log(`Expected: ${expected}`);

if (result !== expected) {
    console.error("FAIL: Output does not match expected");
    process.exit(1);
} else {
    console.log("PASS: Output matches expected");
}
