"use client";

/**
 * Persistent map legend — updates with the active layer so the colours on
 * the atlas always have their key beside them. Chart-room styling: small
 * caps, enamel swatches, one hairline rule.
 */
import { powerColor, shade, techColor, LAYERS, type LayerId } from "../lib/scenarios";
import { TERRAIN_SWATCHES, WATERWAY_SWATCHES } from "../lib/terrain";
import { FAITHS } from "../lib/religion";

const MUTED = "#93a7bd";
const FAINT = "#5f748c";
const GOLD = "#f0c060";

function Swatch({ bg, outline, claim, label, striped }: { bg?: string; outline?: boolean; claim?: boolean; label: string; striped?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-[3px]"
        style={{
          background: striped
            ? `repeating-linear-gradient(90deg, ${bg} 0 4px, #e8f2fa 4px 5px, ${bg} 5px 9px)`
            : (bg ?? "transparent"),
          border: claim ? "1.5px solid #22d3ee" : outline ? `1.5px solid ${GOLD}` : "1px solid rgba(147,167,189,0.35)",
        }}
      />
      <span>{label}</span>
    </span>
  );
}

export default function MapLegend({ layer }: { layer: LayerId }) {
  const rep = powerColor("USA"); // a representative atlas enamel
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 pt-1.5 text-[10px] tracking-wide"
      style={{ color: MUTED }}
      aria-label={`Legend for the ${LAYERS.find((l) => l.id === layer)?.name} layer`}
    >
      <span className="font-display text-[11px] tracking-[0.18em]" style={{ color: GOLD }}>
        LEGEND — {LAYERS.find((l) => l.id === layer)?.name.toUpperCase()}
      </span>

      {layer === "territory" && (
        <>
          <Swatch bg={rep} label="sovereign — wears its own colour" />
          <Swatch bg={shade(rep, 0.62)} label="held territory (darker)" />
          <Swatch outline label="gold outline — your selection" />
          <Swatch claim label="cyan — your claimed nation, its current borders" />
          <span style={{ color: FAINT }}>colour = controlling power — click a tile for its dossier</span>
        </>
      )}
      {layer === "influence" && (
        <>
          <Swatch bg={shade(rep, 0.96)} label="inside another power's orbit" />
          <Swatch bg={shade(rep, 0.55)} label="holds its own orbit (dimmed)" />
          <Swatch outline label="gold outline — your selection" />
          <Swatch claim label="cyan — your claimed nation, its current borders" />
          <span style={{ color: FAINT }}>colour names the top influencer; pull = power × receptivity ÷ distance</span>
        </>
      )}
      {layer === "economic" && (
        <>
          <Swatch bg={shade(rep, 0.96)} label="market ruled from abroad" />
          <Swatch bg={shade(rep, 0.55)} label="dominates its own market (dimmed)" />
          <Swatch outline label="gold outline — your selection" />
          <Swatch claim label="cyan — your claimed nation, its current borders" />
          <span style={{ color: FAINT }}>colour names the dominant market — gravity decays with distance</span>
        </>
      )}
      {layer === "terrain" && (
        <>
          {TERRAIN_SWATCHES.map((s) => (
            <Swatch key={s.name} bg={s.color} label={s.name} />
          ))}
          {WATERWAY_SWATCHES.map((s) => (
            <Swatch key={s.name} bg={s.color} label={s.name} striped={s.canal} />
          ))}
          <span style={{ color: FAINT }}>the land itself — switch layers to lay power back over it</span>
        </>
      )}
      {layer === "religion" && (
        <>
          {FAITHS.map((f) => (
            <Swatch key={f.id} bg={f.color} label={f.name} />
          ))}
          <span style={{ color: FAINT }}>each country wears its dominant faith; held territory darker — faith is a parallel track and feeds no power formula</span>
        </>
      )}
      {layer === "tech" && (
        <>
          <span className="flex items-center gap-0.5" aria-hidden>
            {[0, 18, 36, 54, 72, 90].map((t) => (
              <span key={t} className="inline-block h-2.5 w-6" style={{ background: techColor(t) }} />
            ))}
          </span>
          <span>TECH 0</span>
          <span aria-hidden>→</span>
          <span>TECH 100</span>
          <span style={{ color: FAINT }}>each country coloured by its own technology level; held territory darker</span>
        </>
      )}
    </div>
  );
}
