"""Day 1 Walrus spike — verifies the write/read round-trip end to end.

Runs against the public Walrus testnet, so it needs no credentials. Expected output:
a printed blob_id followed by a read-back that matches the written payload.
"""

import asyncio

from walrus import read_blob, write_blob


async def main():
    payload = {"test": "hello walrus", "timestamp": "2026-06-13"}

    print("Writing payload:", payload)
    blob_id = await write_blob(payload)
    print("blob_id:", blob_id)
    assert blob_id, "write_blob returned no blob_id"

    read_back = await read_blob(blob_id)
    print("read back:", read_back)
    assert read_back == payload, "read-back does not match written payload"

    print("\nOK — Walrus round-trip verified.")


if __name__ == "__main__":
    asyncio.run(main())
