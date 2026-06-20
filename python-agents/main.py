"""FastAPI orchestrator.

Sequences the three agents and streams progress to the dashboard over SSE. Agent 2
runs as a separate Node.js service (POST /analyze on :3001); Agents 1 and 3 run
in-process. Coordination is a per-run asyncio.Queue — no broker, no Redis.
"""

import asyncio
import json
import os
import time

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from agents import report_minter, signal_harvester
from walrus import write_blob

app = FastAPI(title="SignalChain Orchestrator")

# Restrict to specific origins in prod via ALLOWED_ORIGINS (comma-separated);
# defaults to "*" for local dev.
_allowed = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = ["*"] if _allowed.strip() == "*" else [o.strip() for o in _allowed.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

AGENT2_URL = os.getenv("AGENT2_URL", "http://localhost:3001")

pipeline_events: dict[str, asyncio.Queue] = {}


async def execute_pipeline(run_id: str, company: str, sector: str):
    q = pipeline_events[run_id]
    try:
        # Agent 1 — SignalHarvester (in-process)
        await q.put({"stage": "signal_harvester", "status": "running"})
        blob_id_1 = await signal_harvester.run(company)
        await q.put({"stage": "signal_harvester", "status": "complete", "blob_id": blob_id_1})

        # Agent 2 — ThesisBuilder (Node.js microservice)
        await q.put({"stage": "thesis_builder", "status": "running"})
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{AGENT2_URL}/analyze",
                json={"blob_id": blob_id_1, "company": company, "sector": sector},
            )
        r.raise_for_status()
        blob_id_2 = r.json()["blob_id"]
        await q.put({"stage": "thesis_builder", "status": "complete", "blob_id": blob_id_2})

        # Agent 3 — ReportMinter (in-process)
        await q.put({"stage": "report_minter", "status": "running"})
        blob_id_3 = await report_minter.run(blob_id_1, blob_id_2, company)
        await q.put({"stage": "report_minter", "status": "complete", "blob_id": blob_id_3})

    except Exception as e:  # noqa: BLE001 — surface any failure to the client, keep server up
        await q.put({"stage": "error", "status": "failed", "error": str(e)})


@app.post("/run-pipeline")
async def run_pipeline(company: str, sector: str):
    run_id = f"{company}_{int(time.time())}"
    pipeline_events[run_id] = asyncio.Queue()  # create queue FIRST
    asyncio.create_task(execute_pipeline(run_id, company, sector))
    print(f"[run-pipeline] started run_id={run_id} company={company} sector={sector}")
    return {"run_id": run_id}


@app.get("/pipeline/stream/{run_id}")
async def stream(run_id: str):
    if run_id not in pipeline_events:
        raise HTTPException(status_code=404, detail="unknown run_id")

    async def gen():
        q = pipeline_events[run_id]
        try:
            while True:
                event = await q.get()
                yield {"data": json.dumps(event)}
                terminal_ok = event["stage"] == "report_minter" and event["status"] == "complete"
                if terminal_ok or event["stage"] == "error":
                    break
        finally:
            pipeline_events.pop(run_id, None)

    return EventSourceResponse(gen())


@app.post("/internal/write-blob")
async def internal_write_blob(request: Request):
    """Agent 2 proxies its Walrus writes through here."""
    data = await request.json()
    blob_id = await write_blob(data)
    print(f"[internal/write-blob] wrote blob_id={blob_id}")
    return {"blob_id": blob_id}
