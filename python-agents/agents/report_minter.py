"""Agent 3 — ReportMinter.

Reads blob_id_1 (raw signals) and blob_id_2 (thesis) from Walrus, asks Groq to
assemble a Markdown investment memo, appends a deterministic Provenance section that
cites both upstream blob IDs, and writes the final artifact to Walrus as blob_id_3.
"""

import datetime
import json

from groq_llm import chat
from walrus import read_blob, write_blob

SYSTEM_PROMPT = (
    "You are a senior investment analyst writing a concise due-diligence memo in "
    "Markdown. Use clear section headers. Base every claim strictly on the provided "
    "raw signals and thesis — do not invent figures. Do NOT write a Provenance section; "
    "it is appended automatically."
)


def _build_user_prompt(signals: dict, thesis: dict, blob_id_1: str, blob_id_2: str) -> str:
    return (
        f"Raw signals (Walrus blob_id_1 = {blob_id_1}):\n"
        f"{json.dumps(signals, indent=2)}\n\n"
        f"Analysis thesis (Walrus blob_id_2 = {blob_id_2}):\n"
        f"{json.dumps(thesis, indent=2)}\n\n"
        "Write a Markdown investment memo with these sections: Title (company name), "
        "Executive Summary, Bull Case, Bear Case, Red Flags, Confidence. Reference the "
        "prior sector context where the thesis does. Keep it under ~500 words."
    )


async def run(blob_id_1: str, blob_id_2: str, company: str) -> str:
    """Fetch both blobs, generate Markdown report, write to Walrus, return blob_id_3."""
    signals = await read_blob(blob_id_1)
    thesis = await read_blob(blob_id_2)

    generated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    body = await chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(signals, thesis, blob_id_1, blob_id_2)},
        ],
        temperature=0.2,
    )

    provenance = (
        "\n\n## Provenance\n"
        f"- Raw signals: `{blob_id_1}`\n"
        f"- Analysis thesis: `{blob_id_2}`\n"
        f"- Generated: {generated_at}\n"
    )
    report_markdown = body.strip() + provenance

    artifact = {
        "company": company,
        "report_markdown": report_markdown,
        "chain": {"blob_id_1": blob_id_1, "blob_id_2": blob_id_2},
        "generated_at": generated_at,
    }
    return await write_blob(artifact)
