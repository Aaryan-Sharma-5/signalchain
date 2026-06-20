import Head from "next/head";
import { useState } from "react";
import BlobInspector from "@/components/BlobInspector";
import MemoryPanel from "@/components/MemoryPanel";
import PipelineGraph, { PipelineEvent } from "@/components/PipelineGraph";
import ReportModal from "@/components/ReportModal";
import { ORCHESTRATOR_URL } from "@/lib/config";

const COMPANIES = ["Razorpay", "Cashfree", "PayU"];
const SECTOR = "B2B Fintech";

export default function Home() {
  const [company, setCompany] = useState(COMPANIES[0]);
  const [runId, setRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedBlobId, setSelectedBlobId] = useState<string | null>(null);
  const [reportBlobId, setReportBlobId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function startPipeline() {
    setStartError(null);
    setSelectedBlobId(null);
    setReportBlobId(null);
    setShowReport(false);
    setIsRunning(true);
    try {
      const r = await fetch(
        `${ORCHESTRATOR_URL}/run-pipeline?company=${encodeURIComponent(company)}&sector=${encodeURIComponent(SECTOR)}`,
        { method: "POST" }
      );
      if (!r.ok) throw new Error(`run-pipeline failed: ${r.status}`);
      const { run_id } = await r.json();
      setRunId(run_id);
    } catch (e) {
      setStartError(String(e));
      setIsRunning(false);
    }
  }

  function onPipelineEvent(event: PipelineEvent) {
    if (event.stage === "report_minter" && event.status === "complete") {
      setIsRunning(false);
      // Surface the "View Full Report" button (not the modal) so the node-by-node
      // verification flow isn't interrupted — the analyst opens the report on demand.
      if (event.blob_id) setReportBlobId(event.blob_id);
    } else if (event.stage === "error") {
      setIsRunning(false);
    }
  }

  return (
    <>
      <Head>
        <title>SignalChain — Verifiable Due Diligence</title>
      </Head>
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
        {/* LEFT */}
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            background: "var(--panel)",
            display: "flex",
            flexDirection: "column",
            padding: 16,
            gap: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 8 }}>
              Signal<span style={{ color: "var(--accent)", marginLeft: -8 }}>Chain</span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--teal)",
                  boxShadow: "0 0 8px var(--teal-glow)",
                }}
              />
            </div>
            <div className="eyebrow" style={{ marginTop: 6 }}>
              verifiable due diligence
            </div>
          </div>

          <div>
            <label style={labelStyle}>Company</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {COMPANIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCompany(c)}
                  disabled={isRunning}
                  style={{
                    ...selectBtn,
                    borderColor: company === c ? "var(--accent)" : "var(--border)",
                    background: company === c ? "var(--accent-soft)" : "var(--panel-2)",
                    color: company === c ? "var(--text)" : "var(--muted)",
                    cursor: isRunning ? "not-allowed" : "pointer",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startPipeline} disabled={isRunning} style={{ ...runBtn, opacity: isRunning ? 0.6 : 1, cursor: isRunning ? "not-allowed" : "pointer" }}>
            {isRunning ? "Running pipeline…" : `▶ Analyze ${company}`}
          </button>
          {startError && <div style={{ fontSize: 12, color: "var(--red)" }}>⚠ {startError}</div>}

          <div style={{ height: 1, background: "var(--border)" }} />

          <MemoryPanel active={isRunning} />
        </aside>

        {/* CENTER */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <div style={{ position: "absolute", top: 20, fontSize: 12.5, color: "var(--muted)" }}>
            Every node is an immutable Walrus blob. Click any completed node to verify it live.
          </div>
          <PipelineGraph runId={runId} onNodeClick={setSelectedBlobId} onEvent={onPipelineEvent} />

          {reportBlobId && !isRunning && (
            <button onClick={() => setShowReport(true)} style={viewReportBtn}>
              📄 View Full Report
            </button>
          )}
        </main>

        {/* RIGHT */}
        {selectedBlobId && (
          <aside
            style={{
              width: 360,
              flexShrink: 0,
              borderLeft: "1px solid var(--border)",
              background: "var(--panel)",
            }}
          >
            <BlobInspector
              blobId={selectedBlobId}
              onInspect={setSelectedBlobId}
              onClose={() => setSelectedBlobId(null)}
            />
          </aside>
        )}

        {showReport && reportBlobId && (
          <ReportModal blobId={reportBlobId} onClose={() => setShowReport(false)} />
        )}
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 8,
};

const selectBtn: React.CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13.5,
  fontWeight: 500,
};

const runBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(127,119,221,0.6)",
  background: "linear-gradient(180deg, #8b83e6, #6f67cf)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  boxShadow: "0 0 22px var(--accent-glow)",
};

const viewReportBtn: React.CSSProperties = {
  marginTop: 36,
  padding: "14px 28px",
  borderRadius: 10,
  border: "1px solid var(--teal)",
  background: "var(--teal-soft)",
  color: "var(--teal)",
  fontWeight: 700,
  fontSize: 15.5,
  cursor: "pointer",
  boxShadow: "0 0 24px rgba(45,212,191,0.18)",
};
