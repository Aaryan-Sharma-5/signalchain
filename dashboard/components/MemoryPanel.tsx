import { useEffect, useRef, useState } from "react";
import { AGENT2_URL } from "@/lib/config";

interface RawMemory {
  text: string;
  blob_id?: string;
  distance?: number;
}
interface ParsedMemory {
  key: string;
  insight: string;
  company: string;
  sector: string;
}

/** Unfold the "insight... [sector=..; company=..; signal_type=..]" text format. */
function parseMemory(m: RawMemory): ParsedMemory {
  const match = m.text.match(/^([\s\S]*?)\s*\[([^\]]*)\]\s*$/);
  const tags: Record<string, string> = {};
  let insight = m.text;
  if (match) {
    insight = match[1].trim();
    for (const part of match[2].split(";")) {
      const [k, v] = part.split("=").map((s) => s.trim());
      if (k && v) tags[k] = v;
    }
  }
  return {
    key: m.blob_id ?? m.text,
    insight,
    company: tags.company ?? "",
    sector: tags.sector ?? "",
  };
}

interface Props {
  /** Poll faster while a run is active. */
  active: boolean;
}

export default function MemoryPanel({ active }: Props) {
  const [memories, setMemories] = useState<ParsedMemory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());

  async function load(markNew: boolean) {
    try {
      const r = await fetch(`${AGENT2_URL}/memories`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const parsed: ParsedMemory[] = (json.memories ?? []).map(parseMemory);

      const fresh = parsed.filter((p) => !seenRef.current.has(p.key)).map((p) => p.key);
      if (markNew && seenRef.current.size > 0 && fresh.length) {
        setFlashKeys(new Set(fresh));
        setTimeout(() => setFlashKeys(new Set()), 2600);
      }
      parsed.forEach((p) => seenRef.current.add(p.key));

      setMemories(parsed);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => load(true), 5000);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
          MemWal Sector Memory
        </span>
        <span style={{ fontSize: 11, color: "var(--accent)" }}>({memories.length})</span>
      </div>

      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
        {error && <div style={{ fontSize: 12, color: "var(--red)" }}>⚠ {error}</div>}
        {!error && memories.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
            No prior insights yet. Run a company to populate sector memory.
          </div>
        )}
        {memories.map((m) => (
          <div
            key={m.key}
            className={flashKeys.has(m.key) ? "card-flash" : undefined}
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11.5, color: "var(--accent)", marginBottom: 4, fontWeight: 600 }}>
              {m.sector || "—"}
              {m.company ? ` · ${m.company}` : ""}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.45 }}>{m.insight}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
