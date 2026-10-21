import { ImageResponse } from "next/og";

export const alt = "GeoStory Simulator — hex world map in navy and gold";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#f0c060";
const GOLD_DEEP = "#c9963a";
const CREAM = "#f7f0e3";
const PARCH = "#cdbfa5";
const MUTED = "#93a7bd";

// muted aged-atlas tones for the decorative hex-dot field
const DOTS = ["#b3543f", "#c9963a", "#5b7fa6", "#7a6ba5", "#4f7d6a", "#a67c44", "#54707f", "#8c5a6e"];
const ROWS = 9;
const COLS = 14;

function Compass({ size = 84 }: { size?: number }) {
  const spikes = Array.from({ length: 8 }, (_, k) => {
    const a = (Math.PI / 4) * k - Math.PI / 2;
    const long = k % 2 === 0;
    const len = long ? 21 : 12;
    const wdt = long ? 3.4 : 2.2;
    const px = 27 + Math.cos(a) * len, py = 27 + Math.sin(a) * len;
    const bx = 27 + Math.cos(a + Math.PI / 2) * wdt, by = 27 + Math.sin(a + Math.PI / 2) * wdt;
    const bx2 = 27 + Math.cos(a - Math.PI / 2) * wdt, by2 = 27 + Math.sin(a - Math.PI / 2) * wdt;
    return <polygon key={k} points={`${bx},${by} ${px},${py} ${bx2},${by2}`} fill={long ? GOLD : "rgba(240,192,96,0.45)"} />;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 54 54">
      <circle cx="27" cy="27" r="25.5" fill="none" stroke="rgba(240,192,96,0.55)" strokeWidth="1" />
      <circle cx="27" cy="27" r="19.5" fill="none" stroke="rgba(240,192,96,0.3)" strokeWidth="0.7" />
      {spikes}
      <circle cx="27" cy="27" r="2.6" fill={GOLD} />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "linear-gradient(135deg, #0d2f52 0%, #071c33 55%, #040f1e 100%)",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* graticule wash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(90deg, rgba(147,167,189,0.07) 0px, rgba(147,167,189,0.07) 1px, transparent 1px, transparent 96px), repeating-linear-gradient(0deg, rgba(147,167,189,0.07) 0px, rgba(147,167,189,0.07) 1px, transparent 1px, transparent 96px)",
          }}
        />
        {/* decorative hex-dot field, top right */}
        <div style={{ position: "absolute", top: 44, right: 56, display: "flex", flexDirection: "column", gap: 13 }}>
          {Array.from({ length: ROWS }, (_, r) => (
            <div key={r} style={{ display: "flex", gap: 13, marginLeft: r % 2 ? 14 : 0 }}>
              {Array.from({ length: COLS }, (_, c) => {
                const gold = (r * COLS + c) % 17 === 0;
                return (
                  <div
                    key={c}
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 8,
                      background: gold ? GOLD : DOTS[(r * 3 + c * 5) % DOTS.length],
                      opacity: gold ? 0.95 : 0.5,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* masthead */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Compass />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: GOLD, fontSize: 25, letterSpacing: 8, fontWeight: 700 }}>EMBOOGWAY × STRATATIR</div>
            <div style={{ color: MUTED, fontSize: 19, letterSpacing: 3, marginTop: 6 }}>A HEX-MAP TOY MODEL OF THE CENTURY</div>
          </div>
        </div>

        {/* title */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: CREAM, fontSize: 118, fontWeight: 900, lineHeight: 1 }}>GeoStory</div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 14 }}>
            <div style={{ width: 110, height: 3, background: GOLD_DEEP }} />
            <div style={{ color: GOLD, fontSize: 42, letterSpacing: 20, fontWeight: 700 }}>SIMULATOR</div>
            <div style={{ width: 110, height: 3, background: GOLD_DEEP }} />
          </div>
          <div style={{ color: PARCH, fontSize: 29, marginTop: 24, maxWidth: 880 }}>
            Run the century on a hex map — territory, influence, markets and technology, 2026–2100.
          </div>
        </div>

        {/* stat chips */}
        <div style={{ display: "flex", gap: 16 }}>
          {["175 COUNTRIES", "11 SCENARIOS", "PLACE-FOCUSED RUNS", "NOT A FORECAST"].map((t) => (
            <div
              key={t}
              style={{
                border: "1px solid rgba(240,192,96,0.45)",
                color: t === "NOT A FORECAST" ? GOLD : CREAM,
                fontSize: 20,
                letterSpacing: 3,
                padding: "10px 18px",
                borderRadius: 6,
                background: "rgba(4,15,30,0.55)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
