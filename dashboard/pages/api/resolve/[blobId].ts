import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Proxies a blob read to the Walrus aggregator. Keeping this server-side means the
 * dashboard's BlobInspector demonstrably fetches from the Walrus network (visible in
 * the Network tab as /api/resolve/{id} -> aggregator).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { blobId } = req.query as { blobId: string };
  try {
    const upstream = await fetch(`${process.env.WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Blob not found" });
    }
    const data = await upstream.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: `Walrus fetch failed: ${String(e)}` });
  }
}
