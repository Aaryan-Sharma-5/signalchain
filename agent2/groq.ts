import "./env.js";
import type { Thesis } from "./types.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const SYSTEM_PROMPT =
  "You are a financial due-diligence analyst. You return ONLY a single valid JSON " +
  "object — no preamble, no explanation, no markdown code fences. Base every claim " +
  "strictly on the provided signals; do not invent figures.";

/**
 * Run the thesis LLM over the raw signals + recalled sector context. The source
 * blob_id is embedded in the prompt (and re-asserted on the result) so the thesis
 * is cryptographically anchored to its input.
 */
export async function runThesisLLM(
  signals: any,
  sectorContext: string,
  blobId: string
): Promise<Thesis> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const priorContext = sectorContext.trim().length
    ? sectorContext
    : "No prior sector data available.";

  const userPrompt =
    `Source Walrus blob_id (must be echoed back as source_blob_id): ${blobId}\n\n` +
    `Prior sector context from memory:\n${priorContext}\n\n` +
    `Raw company signals JSON:\n${JSON.stringify(signals, null, 2)}\n\n` +
    "Unit note: revenue_growth_yoy and linkedin_growth_90d_pct are decimal fractions — " +
    "multiply by 100 for a percentage (0.38 = 38%, -0.04 = -4%).\n\n" +
    "Produce a JSON object with EXACTLY these fields and no others:\n" +
    "- company (string)\n" +
    "- bull_case (string, 2-3 sentences citing specific figures)\n" +
    "- bear_case (string, 2-3 sentences citing specific figures)\n" +
    "- red_flags (array of 2-4 short, specific strings — each naming a concrete metric)\n" +
    "- confidence_score (number between 0 and 1)\n" +
    "- key_insight: ONE punchy sentence (max 25 words) a fund analyst would actually save to memory. " +
    "It MUST start with the company name, cite at least one concrete figure from the signals " +
    "(revenue growth %, headcount change %, runway, valuation, commit velocity, etc.), and state the " +
    "divergence or risk — NOT a platitude. Avoid generic phrasing like 'contrasting trends' or " +
    "'nuanced analysis'. " +
    'Example: "Razorpay: 38% YoY revenue growth while core-engineering headcount fell 4% — efficiency gains or quiet restructuring."\n' +
    `- source_blob_id (string, must equal "${blobId}")\n` +
    "If prior sector context is present, reference a named peer company from it explicitly in bull_case or bear_case.";

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed: ${res.status} ${await res.text()}`);
  }

  const data: any = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const clean = raw.replace(/```json|```/g, "").trim();
  const thesis = JSON.parse(clean) as Thesis;

  // Enforce the provenance anchor regardless of model behaviour.
  thesis.source_blob_id = blobId;
  if (!thesis.company) thesis.company = signals?.company ?? "";
  return thesis;
}
