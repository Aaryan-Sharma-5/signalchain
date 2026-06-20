"""Agent 1 — SignalHarvester.

Loads the static mock signals for a company and writes them to Walrus, producing
blob_id_1 (the immutable root of the provenance chain).
"""

import json
from pathlib import Path

from walrus import write_blob

MOCK_DIR = Path(__file__).resolve().parent.parent / "mock_data"


async def run(company: str) -> str:
    """Load mock JSON for company, write to Walrus, return blob_id_1."""
    path = MOCK_DIR / f"{company.lower()}_signals.json"
    if not path.exists():
        raise ValueError(
            f"No mock data for company '{company}' (expected {path.name} in mock_data/)"
        )
    signals = json.loads(path.read_text(encoding="utf-8"))
    return await write_blob(signals)
