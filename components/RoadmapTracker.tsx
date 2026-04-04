"use client";
import { useState } from "react";

const phases = [
  {
    id: 1, phase: "Pre-Production", status: "active", progress: 60, duration: "2 months",
    items: [
      { label: "Game Design Document", done: true },
      { label: "Art Bible", done: true },
      { label: "Fighter prototype (Godot 4)", done: false },
      { label: "Rogue prototype", done: false },
      { label: "Kickstarter campaign page", done: false },
      { label: "Website launch", done: true },
    ]
  },
  {
    id: 2, phase: "Alpha", status: "upcoming", progress: 0, duration: "6 months",
    items: [
      { label: "Act I complete", done: false },
      { label: "6 classes playable", done: false },
      { label: "DM Mode v1", done: false },
      { label: "Basic town hub", done: false },
      { label: "Backer beta access", done: false },
    ]
  },
  {
    id: 3, phase: "Beta", status: "upcoming", progress: 0, duration: "6 months",
    items: [
      { label: "Acts II–III", done: false },
      { label: "All 13 classes", done: false },
      { label: "Co-op network layer", done: false },
      { label: "Gear Forge system", done: false },
      { label: "Community feedback iteration", done: false },
    ]
  },
  {
    id: 4, phase: "Gold / Launch", status: "upcoming", progress: 0, duration: "4 months",
    items: [
      { label: "Acts IV–V", done: false },
      { label: "Console certification", done: false },
      { label: "Steam Deck verification", done: false },
      { label: "Post-launch roadmap reveal", done: false },
    ]
  },
  {
    id: 5, phase: "Post-Launch", status: "upcoming", progress: 0, duration: "Ongoing",
    items: [
      { label: "Seasonal content", done: false },
      { label: "Balance patches", done: false },
      { label: "Campaign Creator tools", done: false },
      { label: "Community marketplace", done: false },
    ]
  },
];

const statusColor: Record<string, string> = {
  done: "#4a9a3e",
  active: "#c9963a",
  upcoming: "#3d2e18",
};
const statusLabel: Record<string, string> = {
  done: "COMPLETE",
  active: "IN PROGRESS",
  upcoming: "UPCOMING",
};

export default function RoadmapTracker() {
  const [expanded, setExpanded] = useState<number>(1);

  return (
    <div className="space-y-3">
      {phases.map((p, idx) => (
        <div
          key={p.id}
          className="rounded-xl border overflow-hidden transition-all duration-300"
          style={{
            borderColor: p.status === "active" ? "rgba(201,150,58,0.4)" : "rgba(201,150,58,0.12)",
            background: p.status === "active" ? "linear-gradient(135deg, #2a1f0e, #1c1408)" : "#1c1408",
          }}
        >
          <button
            className="w-full flex items-center gap-4 p-5 text-left"
            onClick={() => setExpanded(expanded === p.id ? 0 : p.id)}
          >
            {/* Number */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-display text-sm flex-shrink-0"
              style={{ background: statusColor[p.status] + "22", color: statusColor[p.status], border: `1px solid ${statusColor[p.status]}40` }}
            >
              {p.status === "done" ? "✓" : idx + 1}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-display tracking-wide text-gold-light">{p.phase}</span>
                <span className="font-display text-xs tracking-widest px-2 py-0.5 rounded"
                  style={{ background: statusColor[p.status] + "22", color: statusColor[p.status] }}>
                  {statusLabel[p.status]}
                </span>
                <span className="text-xs text-gold-dim">{p.duration}</span>
              </div>
              {p.status === "active" && (
                <div className="mt-2 h-1 rounded-full bg-bark-light w-48">
                  <div className="progress-bar h-full rounded-full" data-width={`${p.progress}%`} />
                </div>
              )}
            </div>

            <div className="font-display text-gold-dim text-sm flex-shrink-0">
              {expanded === p.id ? "▲" : "▼"}
            </div>
          </button>

          {expanded === p.id && (
            <div className="px-5 pb-5 border-t border-gold/10">
              <div className="pt-4 grid sm:grid-cols-2 gap-2">
                {p.items.map(item => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all"
                      style={{
                        background: item.done ? "#4a9a3e22" : "#1c1408",
                        border: `1px solid ${item.done ? "#4a9a3e" : "rgba(201,150,58,0.2)"}`,
                        color: item.done ? "#4a9a3e" : "#3d2e18",
                      }}
                    >
                      {item.done ? "✓" : ""}
                    </div>
                    <span style={{ color: item.done ? "#c8b898" : "#7a5e20", textDecoration: item.done ? "none" : "none" }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
