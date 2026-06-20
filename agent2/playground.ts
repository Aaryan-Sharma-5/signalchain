/**
 * Replays the MemWal Developer Playground steps 1-5 against our own server +
 * credentials, to verify the relayer-managed SDK surface we depend on.
 *
 * Steps 6-9 (ask-AI / manual mode) require a client-side OpenRouter/OpenAI key
 * and a wallet signer, so they are out of scope here.
 *
 * Run: npm run playground
 */
import "./env.js";
import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY!,
  accountId: process.env.MEMWAL_ACCOUNT_ID!,
  serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer-staging.memory.walrus.xyz",
  namespace: "playground_test",
});

function log(label: string, val: unknown) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof val === "string" ? val : JSON.stringify(val, null, 2));
}

async function main() {
  // 1. health
  log("1. health()", await memwal.health());

  // 2. remember (enqueue + poll to terminal state)
  const accepted = await memwal.rememberAsync(
    "I'm a software engineer living in Ho Chi Minh City. I love Vietnamese coffee and coding in Rust."
  );
  log("2a. rememberAsync() accepted", accepted);
  const done = await memwal.waitForRememberJob(accepted.job_id, { timeoutMs: 60000 });
  log("2b. waitForRememberJob() terminal", done);

  // 3. recall (positional form, exactly as the playground shows)
  log("3. recall('Where does the user live?', 5)", await memwal.recall("Where does the user live?", 5));

  // 4. analyze (server-side LLM fact extraction — no client LLM key needed)
  log(
    "4. analyze()",
    await memwal.analyze(
      "I prefer dark mode in all my apps. My favorite programming language is Rust. I'm allergic to shellfish."
    )
  );

  // 5. restore (re-index this namespace from Walrus)
  log("5. restore('playground_test')", await memwal.restore("playground_test"));

  console.log("\nOK — playground steps 1-5 verified.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
