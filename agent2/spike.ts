/**
 * Day 1 MemWal spike — stores one insight, then recalls it back.
 *
 * Requires live MemWal credentials in .env (MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID).
 * Expected output: a non-empty formatted string containing the stored test insight.
 *
 * Run: npm run spike
 */
import { recallSectorContext, storeInsight } from "./memwal.js";

async function main() {
  console.log("Storing test insight...");
  await storeInsight(
    "B2B Fintech test: headcount decline with revenue growth.",
    { sector: "B2B Fintech / Payments", company: "TestCo", signal_type: "spike_test" }
  );
  console.log("Stored. Recalling sector context...");

  const context = await recallSectorContext("B2B Fintech / Payments");
  console.log("Recalled context:\n" + (context || "(empty)"));

  if (!context) {
    console.warn("WARNING: recall returned empty — check indexing / credentials.");
  } else {
    console.log("\nOK — MemWal store + recall verified.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
