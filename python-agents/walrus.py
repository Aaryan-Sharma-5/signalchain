"""Walrus HTTP layer for the Python agents.

Exactly two responsibilities: write a JSON blob to the Walrus publisher and read a
blob back from the aggregator. No SDK — just httpx against two public testnet
endpoints. Agents 1 and 3 import this module; Agent 2 (Node.js) proxies its writes
back through FastAPI's /internal/write-blob, which also calls write_blob().
"""

import json
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

PUBLISHER = os.getenv("WALRUS_PUBLISHER", "https://publisher.walrus-testnet.walrus.space")
AGGREGATOR = os.getenv("WALRUS_AGGREGATOR", "https://aggregator.walrus-testnet.walrus.space")


async def write_blob(data: dict) -> str:
    """PUT a JSON dict to the Walrus publisher and return its blob_id.

    Walrus returns `newlyCreated` for fresh content and `alreadyCertified` when the
    identical bytes were stored before — handle both.
    """
    payload = json.dumps(data).encode()
    async with httpx.AsyncClient(timeout=45) as client:
        r = await client.put(
            f"{PUBLISHER}/v1/blobs?epochs=5",
            content=payload,
            headers={"Content-Type": "application/json"},
        )
    r.raise_for_status()
    resp = r.json()
    return (
        resp.get("newlyCreated", {}).get("blobObject", {}).get("blobId")
        or resp.get("alreadyCertified", {}).get("blobId")
    )


async def read_blob(blob_id: str) -> dict:
    """GET a blob from the Walrus aggregator and return the parsed JSON."""
    async with httpx.AsyncClient(timeout=45) as client:
        r = await client.get(f"{AGGREGATOR}/v1/blobs/{blob_id}")
    r.raise_for_status()
    return r.json()
