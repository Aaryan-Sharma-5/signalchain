// Browser-side service endpoints. Override via NEXT_PUBLIC_* at build time if needed.
export const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:8000";

export const AGENT2_URL =
  process.env.NEXT_PUBLIC_AGENT2_URL ?? "http://localhost:3001";

export const WALRUS_AGGREGATOR_PUBLIC =
  "https://aggregator.walrus-testnet.walrus.space";

export function truncateBlobId(id?: string, n = 12): string {
  if (!id) return "";
  return id.length > n ? `${id.slice(0, n)}...` : id;
}
