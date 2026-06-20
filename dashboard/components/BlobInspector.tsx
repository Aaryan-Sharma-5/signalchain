import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertIcon, CheckIcon, CloseIcon, CopyIcon, ExternalLinkIcon, LinkIcon } from "@/components/icons";
import { WALRUS_AGGREGATOR_PUBLIC, truncateBlobId } from "@/lib/config";

interface Props {
  blobId: string;
  onInspect: (blobId: string) => void;
  onClose: () => void;
}

/** Escape + token-colorize a JSON string for display. Input is our own pipeline data. */
function highlightJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "num";
      if (/^"/.test(match)) cls = /:$/.test(match) ? "key" : "str";
      else if (/true|false/.test(match)) cls = "bool";
      else if (/null/.test(match)) cls = "null";
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

type Tab = "raw" | "provenance";

interface AncestorNode {
  id: string;
  label: string;
  kind: string;
  current: boolean;
}

/**
 * Derive the blob's ancestry purely from its own fields:
 *   report  → chain.{blob_id_1, blob_id_2}   (knows both ancestors directly)
 *   thesis  → source_blob_id                 (knows its single parent)
 *   signals → root (no parent)
 */
function buildAncestry(blobId: string, data: any): AncestorNode[] {
  if (data && typeof data.report_markdown === "string" && data.chain) {
    return [
      { id: blobId, label: "report", kind: "blob_id_3", current: true },
      { id: data.chain.blob_id_2, label: "thesis", kind: "blob_id_2", current: false },
      { id: data.chain.blob_id_1, label: "signals", kind: "blob_id_1", current: false },
    ];
  }
  if (data && typeof data.source_blob_id === "string") {
    return [
      { id: blobId, label: "thesis", kind: "blob_id_2", current: true },
      { id: data.source_blob_id, label: "signals", kind: "blob_id_1", current: false },
    ];
  }
  return [{ id: blobId, label: "signals", kind: "blob_id_1", current: true }];
}

export default function BlobInspector({ blobId, onInspect, onClose }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("raw");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setData(null);
    fetch(`/api/resolve/${blobId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setErr(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [blobId]);

  const aggregatorUrl = `${WALRUS_AGGREGATOR_PUBLIC}/v1/blobs/${blobId}`;
  const isThesis = data && typeof data.source_blob_id === "string";
  const isReport = data && typeof data.report_markdown === "string";
  const ancestry = data ? buildAncestry(blobId, data) : [];

  function copyId() {
    navigator.clipboard?.writeText(blobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Blob Inspector
          </span>
          <button onClick={onClose} style={ghostBtn} aria-label="Close">
            <CloseIcon size={15} />
          </button>
        </div>
        <div
          onClick={copyId}
          title="Click to copy"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "monospace",
            fontSize: 12,
            wordBreak: "break-all",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          <span style={{ flex: 1, wordBreak: "break-all" }}>{blobId}</span>
          <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {copied ? (
              <>
                <CheckIcon /> copied
              </>
            ) : (
              <CopyIcon />
            )}
          </span>
        </div>

        {/* live-network provenance badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={networkBadge}>
            <span style={liveDot} />
            WALRUS TESTNET
          </span>
          <a
            href={aggregatorUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", color: "var(--muted)" }}
          >
            <ExternalLinkIcon /> /v1/blobs/{truncateBlobId(blobId, 10)}
          </a>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px 0", borderBottom: "1px solid var(--border)" }}>
        <TabButton active={tab === "raw"} onClick={() => setTab("raw")}>
          Raw blob
        </TabButton>
        <TabButton active={tab === "provenance"} onClick={() => setTab("provenance")}>
          Provenance{ancestry.length > 1 ? ` (${ancestry.length})` : ""}
        </TabButton>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {loading && <Skeleton />}
        {err && (
          <div style={{ color: "var(--red)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertIcon /> {err}
          </div>
        )}

        {data && tab === "raw" && (
          <>
            {isThesis && (
              <div style={chainBox}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>PROVENANCE ANCHOR</div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  source_blob_id:{" "}
                  <span style={{ color: "var(--amber)", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {data.source_blob_id}
                  </span>
                </div>
                <button
                  onClick={() => onInspect(data.source_blob_id)}
                  style={{ ...verifyBtn, display: "inline-flex", alignItems: "center", gap: 7 }}
                >
                  <LinkIcon /> Verify chain — open source blob
                </button>
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 6px", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Raw artifact (live from Walrus)
            </div>
            <pre className="json-view" dangerouslySetInnerHTML={{ __html: highlightJson(data) }} />

            {isReport && (
              <>
                <div style={{ fontSize: 11, color: "var(--muted)", margin: "18px 0 6px", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Rendered report
                </div>
                <div className="markdown-body" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                  <ReactMarkdown>{data.report_markdown}</ReactMarkdown>
                </div>
              </>
            )}
          </>
        )}

        {data && tab === "provenance" && (
          <ProvenanceTrace ancestry={ancestry} onInspect={onInspect} />
        )}
      </div>
    </div>
  );
}

function ProvenanceTrace({ ancestry, onInspect }: { ancestry: AncestorNode[]; onInspect: (id: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.6 }}>
        Chain of custody (resolved from Walrus)
      </div>
      {ancestry.map((node, i) => (
        <div key={node.id ?? i}>
          <div
            onClick={() => node.id && !node.current && onInspect(node.id)}
            style={{
              border: `1px solid ${node.current ? "var(--accent)" : "var(--border-strong)"}`,
              background: node.current ? "var(--accent-soft)" : "var(--panel-2)",
              borderRadius: 8,
              padding: "10px 12px",
              cursor: node.id && !node.current ? "pointer" : "default",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: node.current ? "var(--accent)" : "var(--text)" }}>
                {node.label}
              </span>
              <span style={{ fontSize: 10.5, color: "var(--faint)", fontFamily: "monospace" }}>{node.kind}</span>
            </div>
            <div style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--muted)", marginTop: 4, wordBreak: "break-all" }}>
              {node.id ? truncateBlobId(node.id, 22) : "—"}
            </div>
            {node.current && <div style={{ fontSize: 10.5, color: "var(--accent)", marginTop: 4 }}>● you are here</div>}
            {!node.current && node.id && <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}>click to open →</div>}
          </div>
          {i < ancestry.length - 1 && (
            <div style={{ paddingLeft: 18, color: "var(--faint)", fontSize: 11, lineHeight: 1.4, padding: "4px 0 4px 18px" }}>
              │<br />└─ references
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        color: active ? "var(--text)" : "var(--muted)",
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        padding: "6px 10px 10px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Skeleton() {
  return (
    <div>
      {[90, 70, 80, 60, 75].map((w, i) => (
        <div
          key={i}
          style={{
            height: 12,
            width: `${w}%`,
            background: "var(--panel-2)",
            borderRadius: 4,
            marginBottom: 10,
            opacity: 0.6,
          }}
          className="node-pulse"
        />
      ))}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 14,
};

const networkBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 10,
  fontFamily: "var(--mono)",
  letterSpacing: 0.8,
  color: "var(--teal)",
  background: "var(--teal-soft)",
  border: "1px solid rgba(52,216,196,0.3)",
  borderRadius: 5,
  padding: "3px 7px",
  whiteSpace: "nowrap",
};

const liveDot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--teal)",
  boxShadow: "0 0 6px var(--teal-glow)",
};

const chainBox: React.CSSProperties = {
  background: "var(--amber-soft)",
  border: "1px solid rgba(245,158,11,0.4)",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
};

const verifyBtn: React.CSSProperties = {
  background: "var(--amber)",
  color: "#1a1205",
  border: "none",
  borderRadius: 6,
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
};
