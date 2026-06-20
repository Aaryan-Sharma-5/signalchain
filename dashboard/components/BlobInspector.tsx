import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { WALRUS_AGGREGATOR_PUBLIC } from "@/lib/config";

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

export default function BlobInspector({ blobId, onInspect, onClose }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
          <button onClick={onClose} style={ghostBtn}>
            ✕
          </button>
        </div>
        <div
          onClick={copyId}
          title="Click to copy"
          style={{
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
          {blobId}
          <span style={{ color: "var(--accent)", marginLeft: 8 }}>{copied ? "copied!" : "⧉"}</span>
        </div>
        <a
          href={aggregatorUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", marginTop: 8, fontSize: 11.5, fontFamily: "monospace", wordBreak: "break-all" }}
        >
          ↗ {aggregatorUrl}
        </a>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {loading && <Skeleton />}
        {err && <div style={{ color: "var(--red)", fontSize: 13 }}>⚠ {err}</div>}

        {data && (
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
                <button onClick={() => onInspect(data.source_blob_id)} style={verifyBtn}>
                  ⛓ Verify chain → open source blob
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
      </div>
    </div>
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
