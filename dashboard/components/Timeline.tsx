import { truncateBlobId } from "@/lib/config";

export interface RunRecord {
  id: string;
  company: string;
  time: string; // HH:MM:SS
  signal_harvester?: string;
  thesis_builder?: string;
  report_minter?: string;
}

const BLOCKS = [
  { key: "signal_harvester", label: "Signal", color: "var(--teal)", soft: "var(--teal-soft)" },
  { key: "thesis_builder", label: "Thesis", color: "var(--accent)", soft: "var(--accent-soft)" },
  { key: "report_minter", label: "Report", color: "var(--teal)", soft: "var(--teal-soft)" },
] as const;

interface Props {
  runs: RunRecord[];
  onSelect: (blobId: string) => void;
}

/**
 * Horizontal history of every completed pipeline run. Each colored block reopens
 * that artifact in the inspector — making the "knowledge accumulates across runs"
 * story visual without a word of explanation.
 */
export default function Timeline({ runs, onSelect }: Props) {
  if (runs.length === 0) return null;
  return (
    <div style={wrap}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Run history · {runs.length} {runs.length === 1 ? "run" : "runs"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {runs.map((run) => {
          const blobCount = BLOCKS.filter((b) => run[b.key]).length;
          return (
            <div key={run.id} style={row}>
              <span style={{ width: 86, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                {run.company}
              </span>
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                {BLOCKS.map((b) => {
                  const blobId = run[b.key];
                  return (
                    <button
                      key={b.key}
                      onClick={() => blobId && onSelect(blobId)}
                      disabled={!blobId}
                      title={blobId ? truncateBlobId(blobId, 24) : undefined}
                      style={{
                        ...block,
                        color: b.color,
                        background: b.soft,
                        border: `1px solid ${b.color}`,
                        opacity: blobId ? 1 : 0.3,
                        cursor: blobId ? "pointer" : "default",
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <span style={{ flexShrink: 0, fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>
                {run.time}
              </span>
              <span style={{ flexShrink: 0, width: 52, textAlign: "right", fontSize: 11, color: "var(--faint)" }}>
                {blobCount} blobs
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "12px 16px",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const block: React.CSSProperties = {
  flex: 1,
  maxWidth: 130,
  padding: "5px 0",
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 600,
  fontFamily: "var(--mono)",
};
