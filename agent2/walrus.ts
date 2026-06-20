import "./env.js";

/**
 * Read a blob from the Walrus aggregator. Agent 2 only ever reads from Walrus;
 * its writes are proxied back through FastAPI's /internal/write-blob.
 */
export async function readBlob(blobId: string): Promise<any> {
  const res = await fetch(`${process.env.WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus read failed: ${res.status}`);
  return res.json();
}
