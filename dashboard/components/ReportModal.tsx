import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { WALRUS_AGGREGATOR_PUBLIC } from "@/lib/config";

interface Props {
  blobId: string;
  onClose: () => void;
}

/**
 * The analyst-facing payoff: fetches the report artifact and renders its Markdown memo
 * full-width and readable, instead of as raw JSON in the developer inspector.
 */
export default function ReportModal({ blobId, onClose }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErr(null);
    fetch(`/api/resolve/${blobId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [blobId]);

  const aggregatorUrl = `${WALRUS_AGGREGATOR_PUBLIC}/v1/blobs/${blobId}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4,4,8,0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 24px",
        zIndex: 50,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 780,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {data?.company ? `${data.company} — Due Diligence Report` : "Due Diligence Report"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--teal)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
              <CheckIcon /> Verified on Walrus ·{" "}
              <a href={aggregatorUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace" }}>
                {blobId.slice(0, 16)}…
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
          >
            <CloseIcon /> Close
          </button>
        </div>

        {/* body */}
        <div style={{ padding: "22px 28px" }}>
          {err && (
            <div style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertIcon /> {err}
            </div>
          )}
          {!data && !err && <div style={{ color: "var(--muted)" }}>Loading report from Walrus…</div>}
          {data?.report_markdown && (
            <div className="markdown-body">
              <ReactMarkdown>{data.report_markdown}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
