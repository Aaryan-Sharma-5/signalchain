/**
 * Agent 2 — ThesisBuilder Express server.
 *
 * POST /analyze : the only pipeline route. Reads blob_id_1 from Walrus, recalls
 *   sector memory, runs the Groq thesis LLM, stores the key insight back into
 *   MemWal, proxies the thesis write to FastAPI, and returns blob_id_2.
 * GET  /memories : recent MemWal sector insights for the dashboard memory panel.
 * GET  /health   : liveness.
 */
import "./env.js";
import cors from "cors";
import express from "express";
import { recallSectorContext, recentMemories, storeInsight } from "./memwal.js";
import { runThesisLLM } from "./groq.js";
import type { AnalyzeRequest } from "./types.js";
import { readBlob } from "./walrus.js";

const app = express();
// Restrict to specific origin(s) in prod via CORS_ORIGIN (comma-separated);
// defaults to reflecting any origin for local dev.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8000";

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "agent2" });
});

app.post("/analyze", async (req, res) => {
  const { blob_id, company, sector } = req.body as AnalyzeRequest;
  try {
    // 1. Fetch raw signals from Walrus.
    const signals = await readBlob(blob_id);

    // 2. Recall prior sector context (empty string on first run).
    const sectorContext = await recallSectorContext(sector);
    console.log(
      `[analyze] ${company} / ${sector} — recalled sector context:\n` +
        (sectorContext || "(none — first run for this sector)")
    );

    // 3. Run the thesis LLM.
    const thesis = await runThesisLLM(signals, sectorContext, blob_id);

    // 4. Store the insight back into sector memory.
    await storeInsight(thesis.key_insight, {
      sector,
      company,
      signal_type: "thesis_insight",
    });

    // 5. Proxy the thesis write to FastAPI's Walrus writer.
    const writeRes = await fetch(`${ORCHESTRATOR_URL}/internal/write-blob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(thesis),
    });
    if (!writeRes.ok) {
      throw new Error(`write-blob proxy failed: ${writeRes.status} ${await writeRes.text()}`);
    }
    const result: any = await writeRes.json();

    // 6. Return blob_id_2.
    res.json({ blob_id: result.blob_id });
  } catch (e) {
    console.error("[analyze] error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/memories", async (_req, res) => {
  try {
    res.json({ memories: await recentMemories() });
  } catch (e) {
    console.error("[memories] error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// Cloud hosts (Render/Railway/Fly) inject PORT. Bind with no explicit host so Node
// listens dual-stack (IPv4 + IPv6) — required because FastAPI reaches us via
// "localhost", which resolves to ::1 first on Windows.
const port = Number(process.env.PORT ?? process.env.AGENT2_PORT ?? 3001);
app.listen(port, () => {
  console.log(`Agent 2 listening on :${port}`);
});
