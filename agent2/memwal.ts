/**
 * MemWal client for Agent 2 — the ONLY service that touches the MemWal SDK.
 *
 * NOTE on the SDK surface (verified against MystenLabs/MemWal README + SKILL.md):
 *   - remember(text, namespace?)        -> { job_id, status }
 *   - rememberAndWait(text, namespace?, opts?)  (may be absent in some beta builds)
 *   - waitForRememberJob(jobId, opts?)
 *   - recall({ query, topK?/limit?, maxDistance?, namespace? })
 *        -> { results: [{ blob_id, text, distance }], total }
 *
 * The SDK has NO structured-metadata channel, so storeInsight folds metadata into the
 * memory text. recall returns `text` (not `content`/`metadata`), so the folded tags
 * survive retrieval. We normalize defensively in case a beta build returns a bare array.
 */
import "./env.js";
import { MemWal } from "@mysten-incubation/memwal";

export const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY!,
  accountId: process.env.MEMWAL_ACCOUNT_ID!,
  serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz",
  namespace: process.env.MEMWAL_NAMESPACE ?? "due_diligence",
});

/**
 * Retry wrapper for relayer calls. This machine's network intermittently throws
 * UND_ERR_CONNECT_TIMEOUT / ENOTFOUND against the MemWal relayer even though it is
 * reachable, so transient failures are retried with linear backoff.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.warn(`[memwal] ${label} attempt ${i}/${attempts} failed: ${(e as Error).message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

/** Normalize recall output to a plain array across SDK shapes. */
function recallItems(res: any): any[] {
  return Array.isArray(res) ? res : (res?.results ?? []);
}

/**
 * Store an insight in sector memory. Metadata is folded into the text because the SDK
 * exposes no structured-metadata field. Uses rememberAndWait when available, otherwise
 * falls back to remember() + waitForRememberJob() (beta safety).
 */
export async function storeInsight(
  insight: string,
  metadata: Record<string, string>
): Promise<void> {
  const tags = Object.entries(metadata)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  const text = tags ? `${insight} [${tags}]` : insight;

  const client = memwal as any;
  try {
    // Getting the job ACCEPTED by the relayer is the part that must succeed —
    // once accepted, embedding + indexing complete asynchronously server-side.
    const job: any = await withRetry<any>("remember(submit)", () => client.remember(text));

    // Best-effort wait for terminal state. The relayer can be slow to index, so a
    // timeout here is NOT fatal: the job is already accepted and will finish.
    try {
      await client.waitForRememberJob(job.job_id, { timeoutMs: 60000 });
      console.log(`[memwal] storeInsight indexed (job_id=${job.job_id})`);
    } catch (e) {
      console.warn(
        `[memwal] storeInsight accepted (job_id=${job.job_id}) but wait failed: ` +
          `${(e as Error).message} — continuing (will index server-side)`
      );
    }
  } catch (e) {
    // Non-fatal: a flaky relayer must not sink the whole pipeline. The thesis is
    // still produced and written to Walrus; only cross-run recall is affected.
    console.warn(
      `[memwal] storeInsight failed to submit after retries: ${(e as Error).message} — ` +
        "continuing without storing"
    );
  }
}

/**
 * Recall up to 3 relevant sector insights and return a formatted bullet list.
 * Returns "" when there is nothing relevant (e.g. the first run for a sector).
 */
export async function recallSectorContext(sector: string): Promise<string> {
  try {
    const res: any = await withRetry("recallSectorContext", () =>
      memwal.recall({
        query: `${sector} headcount revenue divergence thesis`,
        topK: 3,
        maxDistance: 0.7,
      } as any)
    );
    const items = recallItems(res);
    if (!items.length) return "";
    return items.map((m) => `- ${m.text ?? m.content}`).join("\n");
  } catch (e) {
    // Non-fatal: a relayer outage (e.g. 503) must not sink the pipeline. Degrade to
    // "no prior context" — exactly like a first run — and let the thesis proceed.
    console.warn(
      `[memwal] recallSectorContext failed: ${(e as Error).message} — proceeding with no prior context`
    );
    return "";
  }
}

/** Recent sector memories for the dashboard memory panel (broad query). */
export async function recentMemories(): Promise<
  Array<{ text: string; blob_id?: string; distance?: number }>
> {
  try {
    const res: any = await withRetry("recentMemories", () =>
      memwal.recall({
        query: "fintech payments thesis insight headcount revenue valuation",
        topK: 10,
        maxDistance: 1.0,
      } as any)
    );
    // Re-running the same company appends a fresh near-identical insight each time,
    // so collapse duplicates by the insight text (the part before the "[tags]"),
    // keeping the most relevant (first) occurrence.
    const seen = new Set<string>();
    const deduped: Array<{ text: string; blob_id?: string; distance?: number }> = [];
    for (const m of recallItems(res)) {
      const text: string = m.text ?? m.content ?? "";
      const insightKey = text.split(" [")[0].trim().toLowerCase().replace(/\s+/g, " ");
      if (!insightKey || seen.has(insightKey)) continue;
      seen.add(insightKey);
      deduped.push({ text, blob_id: m.blob_id, distance: m.distance });
    }
    return deduped;
  } catch (e) {
    // Non-fatal: the memory panel just shows empty during a relayer blip rather than erroring.
    console.warn(`[memwal] recentMemories failed: ${(e as Error).message}`);
    return [];
  }
}
