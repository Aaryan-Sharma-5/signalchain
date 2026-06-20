/** Shared interfaces for Agent 2 (ThesisBuilder). */

/** The thesis artifact written to Walrus as blob_id_2. Exact shape — no extra fields. */
export interface Thesis {
  company: string;
  bull_case: string;
  bear_case: string;
  red_flags: string[];
  confidence_score: number; // 0-1
  key_insight: string; // one sentence, suitable for MemWal
  source_blob_id: string; // blob_id_1
}

/** Request body for POST /analyze. */
export interface AnalyzeRequest {
  blob_id: string;
  company: string;
  sector: string;
}
