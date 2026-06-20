import { useEffect, useRef, useState } from "react";
import { AlertIcon } from "@/components/icons";
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  function copyBlobId(key: string, blobId: string) {
    navigator.clipboard?.writeText(blobId);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  }

  useEffect(() => {
    if (!runId) return;
    // New run: reset graph, mark first node running.
    setError(null);
    setConfidence(null);
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
        // Pull the confidence score off the thesis blob for the node gauge.
        if (event.stage === "thesis_builder" && event.blob_id) {
          fetch(`/api/resolve/${event.blob_id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d && typeof d.confidence_score === "number") setConfidence(d.confidence_score);
            })
            .catch(() => {});
        }
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
          <filter id="glow-amber" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f5b14b" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* connectors: dim when idle, animated purple flow while data moves to the
            next stage, solid once the downstream blob lands. Edge label fades in
            only after the upstream blob actually exists. */}
        {NODES.slice(0, -1).map((n, i) => {
          const x1 = positions[i] + NODE_W;
          const x2 = positions[i + 1];
          const y = TOP + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          const label = i === 0 ? "blob_id_1" : "blob_id_2";
          const srcDone = states[n.key].status === "complete";
          const nextStatus = states[NODES[i + 1].key].status;
          const flowing = srcDone && nextStatus === "running";
          return (
            <g key={`edge-${i}`}>
              <line
                x1={x1 + 6}
                y1={y}
                x2={x2 - 6}
                y2={y}
                stroke={srcDone ? "var(--accent)" : "var(--border)"}
                strokeWidth={flowing ? 2.5 : 2}
                markerEnd="url(#arrow)"
                className={flowing ? "flow-line" : undefined}
              />
              {srcDone && (
                <text
                  key={`lbl-${label}`}
                  x={midX}
                  y={y - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill={flowing ? "var(--accent)" : "var(--muted)"}
                  fontFamily="monospace"
                  className="edge-label-in"
                >
                  {label}
                </text>
              )}
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
          const glow =
            st.status === "complete"
              ? isTeal
                ? "url(#glow-teal)"
                : "url(#glow-purple)"
              : st.status === "running"
                ? "url(#glow-amber)"
                : undefined;
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
                strokeDasharray={st.status === "idle" ? "6 6" : undefined}
                filter={glow}
                opacity={st.status === "idle" ? 0.7 : 1}
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
                <g
                  className="blob-chip-hit"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyBlobId(n.key, st.blobId!);
                  }}
                >
                  <title>Click to copy full blob ID</title>
                  <rect
                    className="blob-chip-bg"
                    x={14}
                    y={66}
                    width={168}
                    height={22}
                    rx={5}
                    fill="rgba(255,255,255,0.04)"
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                  <text x={24} y={81} fontSize="12" fill={n.color} fontFamily="monospace">
                    {copiedKey === n.key ? "copied!" : truncateBlobId(st.blobId, 16)}
                  </text>
                  {copiedKey === n.key ? (
                    <g
                      transform="translate(166, 70) scale(0.5)"
                      fill="none"
                      stroke="var(--teal)"
                      strokeWidth={3.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </g>
                  ) : (
                    <g
                      transform="translate(166, 70) scale(0.5)"
                      fill="none"
                      stroke="var(--muted)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </g>
                  )}
                </g>
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
                <text
                  x={16}
                  y={80}
                  fontSize="12"
                  fill={st.status === "error" ? "var(--red)" : "var(--faint)"}
                  fontStyle="italic"
                >
                  {st.status === "error" ? "failed" : "Waiting for run…"}
                </text>
              )}
              {/* confidence gauge on the thesis node once its blob is resolved */}
              {n.key === "thesis_builder" && st.status === "complete" && confidence != null && (
                <ConfidenceGauge score={confidence} cx={NODE_W - 30} cy={32} />
              )}
              {clickable && (
                <text x={16} y={98} fontSize="10.5" fill="var(--muted)">
                  click to inspect →
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
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AlertIcon /> {error}
        </div>
      )}
    </div>
  );
}

/** Radial confidence gauge (0-1) rendered on the thesis node after completion. */
function ConfidenceGauge({ score, cx, cy }: { score: number; cx: number; cy: number }) {
  const r = 14;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score));
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
      <circle
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${pct * C} ${C}`}
        transform="rotate(-90)"
      />
      <text textAnchor="middle" y={4} fontSize="11" fontWeight={700} fill="var(--text)">
        {Math.round(pct * 100)}
      </text>
      <text textAnchor="middle" y={r + 12} fontSize="8.5" fill="var(--muted)" fontFamily="monospace">
        confidence
      </text>
    </g>
  );
}
