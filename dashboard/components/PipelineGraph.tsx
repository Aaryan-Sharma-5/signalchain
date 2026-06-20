import { useEffect, useRef, useState } from "react";
import { ORCHESTRATOR_URL, truncateBlobId } from "@/lib/config";

type Status = "idle" | "running" | "complete" | "error";
interface NodeState {
  status: Status;
  blobId?: string;
}
type StatesByStage = Record<string, NodeState>;

export interface PipelineEvent {
  stage: string;
  status: string;
  blob_id?: string;
  error?: string;
}

const NODES = [
  { key: "signal_harvester", title: "SignalHarvester", agent: "Agent 1", runtime: "Python", color: "var(--teal)" },
  { key: "thesis_builder", title: "ThesisBuilder", agent: "Agent 2", runtime: "Node.js + MemWal", color: "var(--accent)" },
  { key: "report_minter", title: "ReportMinter", agent: "Agent 3", runtime: "Python", color: "var(--teal)" },
] as const;

const STAGE_ORDER: string[] = NODES.map((n) => n.key);

const FILL: Record<Status, string> = {
  idle: "#10101a",
  running: "#181321",
  complete: "#10101a",
  error: "#1f1117",
};

function emptyStates(): StatesByStage {
  return {
    signal_harvester: { status: "idle" },
    thesis_builder: { status: "idle" },
    report_minter: { status: "idle" },
  };
}

interface Props {
  runId: string | null;
  onNodeClick: (blobId: string) => void;
  onEvent?: (event: PipelineEvent) => void;
}

export default function PipelineGraph({ runId, onNodeClick, onEvent }: Props) {
  const [states, setStates] = useState<StatesByStage>(emptyStates());
  const [error, setError] = useState<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!runId) return;
    // New run: reset graph, mark first node running.
    setError(null);
    setStates({
      signal_harvester: { status: "running" },
      thesis_builder: { status: "idle" },
      report_minter: { status: "idle" },
    });

    const source = new EventSource(`${ORCHESTRATOR_URL}/pipeline/stream/${runId}`);
    source.onmessage = (e) => {
      const event: PipelineEvent = JSON.parse(e.data);
      onEventRef.current?.(event);

      if (event.stage === "error") {
        setError(event.error ?? "Pipeline failed");
        setStates((prev) => {
          const next = { ...prev };
          for (const k of STAGE_ORDER) {
            if (next[k].status === "running") next[k] = { ...next[k], status: "error" };
          }
          return next;
        });
        source.close();
        return;
      }

      if (event.status === "running") {
        setStates((prev) => ({
          ...prev,
          [event.stage]: { ...prev[event.stage], status: "running" },
        }));
        return;
      }

      if (event.status === "complete") {
        setStates((prev) => {
          const next: StatesByStage = {
            ...prev,
            [event.stage]: { status: "complete", blobId: event.blob_id },
          };
          // Infer "running" for the next stage in the chain.
          const idx = STAGE_ORDER.indexOf(event.stage);
          const nextKey = STAGE_ORDER[idx + 1];
          if (nextKey && next[nextKey].status === "idle") {
            next[nextKey] = { status: "running" };
          }
          return next;
        });
        if (event.stage === "report_minter") source.close();
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [runId]);

  // SVG geometry
  const NODE_W = 200;
  const NODE_H = 110;
  const GAP = 90;
  const TOP = 50;
  const positions = NODES.map((_, i) => i * (NODE_W + GAP));
  const totalW = positions[positions.length - 1] + NODE_W;
  const viewH = TOP + NODE_H + 90;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <svg
        viewBox={`0 0 ${totalW} ${viewH}`}
        style={{ width: "100%", maxWidth: 980 }}
        role="img"
        aria-label="Blob provenance chain"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)" />
          </marker>
          <filter id="glow-teal" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#34d8c4" floodOpacity="0.5" />
          </filter>
          <filter id="glow-purple" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#7f77dd" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* connectors + edge labels */}
        {NODES.slice(0, -1).map((n, i) => {
          const x1 = positions[i] + NODE_W;
          const x2 = positions[i + 1];
          const y = TOP + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          const label = i === 0 ? "blob_id_1" : "blob_id_2";
          const done = states[n.key].status === "complete";
          return (
            <g key={`edge-${i}`}>
              <line
                x1={x1 + 6}
                y1={y}
                x2={x2 - 6}
                y2={y}
                stroke={done ? "var(--accent)" : "var(--border)"}
                strokeWidth={2}
                markerEnd="url(#arrow)"
              />
              <text x={midX} y={y - 12} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="monospace">
                {label}
              </text>
            </g>
          );
        })}

        {/* nodes */}
        {NODES.map((n, i) => {
          const st = states[n.key];
          const x = positions[i];
          const clickable = st.status === "complete" && !!st.blobId;
          const isTeal = n.color === "var(--teal)";
          const strokeColor =
            st.status === "complete"
              ? n.color
              : st.status === "running"
                ? "var(--amber)"
                : st.status === "error"
                  ? "var(--red)"
                  : "var(--border-strong)";
          const fill =
            st.status === "complete" ? (isTeal ? "var(--teal-soft)" : "var(--accent-soft)") : FILL[st.status];
          const glow = st.status === "complete" ? (isTeal ? "url(#glow-teal)" : "url(#glow-purple)") : undefined;
          return (
            <g
              key={n.key}
              transform={`translate(${x}, ${TOP})`}
              onClick={() => clickable && onNodeClick(st.blobId!)}
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={14}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={1.5}
                filter={glow}
                className={st.status === "running" ? "node-pulse" : undefined}
              />
              <text x={16} y={26} fontSize="11" fill="var(--muted)" fontFamily="monospace">
                {n.agent} · {n.runtime}
              </text>
              <text x={16} y={50} fontSize="16" fontWeight={600} fill="var(--text)">
                {n.title}
              </text>
              {/* status / blob id */}
              {st.status === "complete" && st.blobId ? (
                <text x={16} y={80} fontSize="12.5" fill={n.color} fontFamily="monospace">
                  {truncateBlobId(st.blobId)}
                </text>
              ) : st.status === "running" ? (
                <>
                  {/* spinner */}
                  <g transform={`translate(${NODE_W - 24}, 22)`}>
                    <circle
                      cx={0}
                      cy={0}
                      r={7}
                      fill="none"
                      stroke="var(--amber)"
                      strokeWidth={2}
                      strokeDasharray="11 22"
                      strokeLinecap="round"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 0 0"
                        to="360 0 0"
                        dur="0.9s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                  <text x={16} y={80} fontSize="12" fill="var(--amber)" fontStyle="italic">
                    Writing to Walrus…
                  </text>
                </>
              ) : (
                <text x={16} y={80} fontSize="12" fill="var(--muted)" fontStyle="italic">
                  {st.status === "error" ? "failed" : "idle"}
                </text>
              )}
              {clickable && (
                <text x={16} y={98} fontSize="10.5" fill="var(--muted)">
                  click to inspect ↗
                </text>
              )}
            </g>
          );
        })}

        {/* MemWal recall annotation under Agent 2 */}
        <g transform={`translate(${positions[1] + NODE_W / 2}, ${TOP + NODE_H + 28})`}>
          <circle cx={0} cy={-4} r={4} fill="var(--accent)" />
          <text x={12} y={0} fontSize="11" fill="var(--accent)" fontFamily="monospace">
            MemWal recall
          </text>
        </g>
      </svg>

      {error && (
        <div
          style={{
            color: "var(--red)",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            maxWidth: 700,
          }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
