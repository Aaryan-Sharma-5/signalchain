"""Minimal async Groq chat client (OpenAI-compatible endpoint).

Used by Agent 3 (report_minter) for Markdown report assembly. Agent 2 has its own
TypeScript Groq client. No SDK — just httpx against the chat-completions endpoint.
"""

import os

import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def chat(messages: list[dict], temperature: float = 0.2) -> str:
    """Call Groq chat completions and return the assistant message content."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set")
    payload = {"model": GROQ_MODEL, "messages": messages, "temperature": temperature}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            GROQ_URL,
            json=payload,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]
