"use client";

/**
 * Export section for one sim panel — the share kit. Renders the panel's
 * deterministic century into social-ready artifacts (timelapse video,
 * recap card PNG, caption text) entirely client-side via exportKit.
 * Files are named for the run so they drop straight into a posting flow.
 */
import { useRef, useState } from "react";
import type { SimConfig, SimResult } from "../lib/engine";
import {
  buildCaption, copyText, downloadBlob, recordTimelapse, renderRecapCard,
  slugify, videoExportSupported, type TimelapseFormat,
} from "./exportKit";

const CREAM = "#f7f0e3";
const MUTED = "#93a7bd";
const FAINT = "#5f748c";
const GOLD = "#f0c060";
const GOLD_DEEP = "#c9963a";

type Fmt = TimelapseFormat | "1:1";

export default function ExportPanel({ cfg, result }: { cfg: SimConfig; result: SimResult }) {
  const [format, setFormat] = useState<Fmt>("9:16");
  const [busy, setBusy] = useState<null | "video" | "card">(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cancelRef = useRef(false);
  const canVideo = videoExportSupported();
  const base = `geostory-${slugify(cfg.scenarioId)}-${slugify(cfg.seed)}`;

  const doVideo = async () => {
    if (busy || !canVideo) return;
    cancelRef.current = false;
    setBusy("video");
    setProgress(0);
    setNote(null);
    try {
      const out = await recordTimelapse(result, cfg, format === "1:1" ? "1:1" : "9:16", {
        onProgress: (f) => setProgress(f),
        cancelled: () => cancelRef.current,
      });
      if (out) {
        downloadBlob(out.blob, `${base}-timelapse-${format === "1:1" ? "1x1" : "9x16"}.${out.ext}`);
        setNote("Timelapse saved — the full century, ready to post.");
      } else {
        setNote("Export cancelled.");
      }
    } catch {
      setNote("Video export failed in this browser — the recap card and caption still work.");
    }
    setBusy(null);
  };

  const doCard = async () => {
    if (busy) return;
    setBusy("card");
    setNote(null);
    try {
      const blob = await renderRecapCard(result, cfg, format === "1:1" ? "1:1" : "9:16");
      downloadBlob(blob, `${base}-recap-${format === "1:1" ? "1x1" : "9x16"}.png`);
      setNote("Recap card saved — winner, top five and the century's biggest shocks.");
    } catch {
      setNote("Card rendering failed in this browser.");
    }
    setBusy(null);
  };

  const doCaption = async () => {
    const ok = await copyText(buildCaption(result, cfg));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      setNote("Clipboard blocked by this browser — the caption could not be copied.");
    }
  };

  const btn = "rounded px-3 py-2 text-[11px] font-bold tracking-wider disabled:opacity-50";
  const ghost = "rounded border px-3 py-2 text-[11px] font-semibold tracking-wider disabled:opacity-50";

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-display text-xs tracking-[0.18em]" style={{ color: GOLD }}>⬇ EXPORT THIS RUN</span>
        <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(201,150,58,0.45), rgba(201,150,58,0.05))" }} />
        <div className="flex overflow-hidden rounded-md border" style={{ borderColor: "rgba(201,150,58,0.35)" }} role="group" aria-label="Export format">
          {(["9:16", "1:1"] as Fmt[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              aria-label={`Export format ${f}${f === "9:16" ? " (vertical, for TikTok / Reels / Shorts)" : " (square)"}`}
              className="px-2.5 py-1 font-mono text-[11px]"
              style={{ background: format === f ? GOLD_DEEP : "transparent", color: format === f ? "#081426" : "#cbb27a" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <p className="pb-2 text-[11px] leading-snug" style={{ color: FAINT }}>
        Clean, branded artifacts of this exact run — no page chrome. Drop them straight into your posting flow.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={doVideo} disabled={busy !== null || !canVideo} className={btn}
          style={{ background: `linear-gradient(150deg,#e8bc58,${GOLD_DEEP})`, color: "#081426" }}
          aria-label="Download an animated timelapse video of this run">
          {busy === "video" ? `🎬 RENDERING ${Math.round(progress * 100)}%` : "🎬 TIMELAPSE VIDEO"}
        </button>
        {busy === "video" && (
          <button onClick={() => { cancelRef.current = true; }} className={ghost}
            style={{ borderColor: "rgba(209,96,61,0.5)", color: "#e09a83" }}>
            CANCEL
          </button>
        )}
        <button onClick={doCard} disabled={busy !== null} className={ghost}
          style={{ borderColor: "rgba(240,192,96,0.5)", color: GOLD }}
          aria-label="Download a recap card image of this run">
          {busy === "card" ? "RENDERING…" : "🗺 RECAP CARD PNG"}
        </button>
        <button onClick={doCaption} className={ghost}
          style={{ borderColor: "rgba(147,167,189,0.4)", color: CREAM }}
          aria-label="Copy a ready-to-post caption for this run">
          {copied ? "✓ COPIED" : "⧉ COPY CAPTION"}
        </button>
      </div>
      {!canVideo && (
        <p className="pt-2 text-[11px]" style={{ color: MUTED }}>
          Video export isn&apos;t supported in this browser (no MediaRecorder) — the recap card and caption work everywhere.
        </p>
      )}
      {busy === "video" && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded" style={{ background: "rgba(201,150,58,0.18)" }}>
          <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: GOLD }} />
        </div>
      )}
      {note && <p className="pt-2 text-[11px]" style={{ color: MUTED }} role="status">{note}</p>}
    </div>
  );
}
