"use client";
import { useState } from "react";

const classes = [
  { name: "Fighter", role: "Tank", icon: "⚔️", color: "#c9963a", desc: "Unstoppable front-liner. Masters of shields and heavy blades. When the Fighter stands, the dungeon cowers.", stats: { str: 95, agi: 55, int: 30, vit: 90 } },
  { name: "Rogue", role: "Stealth", icon: "🗡️", color: "#a0a0c0", desc: "Strike from shadow, vanish before the blood hits the floor. The Rogue is never where you expect.", stats: { str: 60, agi: 95, int: 65, vit: 50 } },
  { name: "Wizard", role: "Arcane", icon: "✨", color: "#8080ff", desc: "Bend reality at the cost of your body. The Wizard's power is godlike — and fragile.", stats: { str: 20, agi: 45, int: 99, vit: 30 } },
  { name: "Cleric", role: "Healer", icon: "☀️", color: "#f0d060", desc: "Light in the darkness. The Cleric keeps the party alive — and can smite anything that threatens it.", stats: { str: 55, agi: 40, int: 80, vit: 80 } },
  { name: "Ranger", role: "Scout", icon: "🏹", color: "#60c060", desc: "Master of terrain and range. The Ranger sees what the dungeon tries to hide.", stats: { str: 60, agi: 85, int: 60, vit: 60 } },
  { name: "Paladin", role: "Holy", icon: "🛡️", color: "#e0c080", desc: "Holy conviction made flesh. The Paladin fights with faith and falls last.", stats: { str: 80, agi: 40, int: 60, vit: 95 } },
  { name: "Barbarian", role: "Berserker", icon: "🪓", color: "#c04030", desc: "Rage is the only armor needed. The Barbarian hits harder as the wounds pile up.", stats: { str: 99, agi: 65, int: 10, vit: 85 } },
  { name: "Druid", role: "Nature", icon: "🌿", color: "#40a040", desc: "Shape the battlefield itself. The Druid summons, transforms, and overgrows everything in its path.", stats: { str: 50, agi: 60, int: 85, vit: 65 } },
  { name: "Bard", role: "Support", icon: "🎶", color: "#e060a0", desc: "Chaos in a lute. The Bard buffs, debuffs, and somehow wins fights nobody else could.", stats: { str: 40, agi: 70, int: 75, vit: 55 } },
  { name: "Warlock", role: "Dark", icon: "🔮", color: "#9040c0", desc: "Power borrowed from something ancient. The Warlock's patron always collects eventually.", stats: { str: 35, agi: 55, int: 95, vit: 45 } },
  { name: "Monk", role: "Agile", icon: "👊", color: "#40c0c0", desc: "Empty hands, full devastation. The Monk's body is the weapon — honed to perfection.", stats: { str: 70, agi: 90, int: 55, vit: 70 } },
  { name: "Sorcerer", role: "Wild", icon: "⚡", color: "#f08020", desc: "Magic with no governor. The Sorcerer's power surges wildly — catastrophically effective.", stats: { str: 25, agi: 50, int: 90, vit: 35 } },
  { name: "Artificer", role: "Inventor", icon: "⚙️", color: "#80a0c0", desc: "Gadgets, traps, and mechanical mayhem. The Artificer builds their way through any dungeon.", stats: { str: 45, agi: 65, int: 88, vit: 60 } },
];

const statLabels = ["str", "agi", "int", "vit"] as const;
const statColors: Record<string, string> = { str: "#c43e1c", agi: "#4a9a3e", int: "#5060c0", vit: "#c9963a" };

export default function ClassSelector() {
  const [selected, setSelected] = useState(0);
  const cls = classes[selected];

  return (
    <div className="w-full">
      {/* Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-8">
        {classes.map((c, i) => (
          <button
            key={c.name}
            onClick={() => setSelected(i)}
            className="flex flex-col items-center p-3 rounded-xl border transition-all duration-200"
            style={{
              background: selected === i ? `${c.color}18` : "#1c1408",
              borderColor: selected === i ? c.color : "rgba(201,150,58,0.12)",
              transform: selected === i ? "translateY(-4px)" : "none",
              boxShadow: selected === i ? `0 8px 24px ${c.color}30` : "none",
            }}
          >
            <div style={{ fontSize: "24px" }}>{c.icon}</div>
            <div className="font-display text-xs tracking-wide mt-1" style={{ color: selected === i ? c.color : "#7a5e20", fontSize: "10px" }}>{c.name}</div>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <div
        key={selected}
        className="rounded-xl border p-8 transition-all"
        style={{
          background: `linear-gradient(135deg, #1c1408, ${cls.color}08)`,
          borderColor: `${cls.color}40`,
          animation: "fadeIn 0.3s ease forwards",
        }}
      >
        <div className="md:flex gap-8 items-start">
          <div className="text-6xl mb-4 md:mb-0 animate-wiggle" style={{ animationDuration: "3s" }}>{cls.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-display text-3xl" style={{ color: cls.color }}>{cls.name}</h3>
              <span className="font-display text-xs tracking-widest px-2 py-1 rounded" style={{ background: `${cls.color}20`, color: cls.color }}>{cls.role}</span>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "#c8b898" }}>{cls.desc}</p>
            <div className="grid grid-cols-2 gap-3">
              {statLabels.map(stat => (
                <div key={stat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-display tracking-widest" style={{ color: statColors[stat] }}>{stat.toUpperCase()}</span>
                    <span style={{ color: "#7a5e20" }}>{cls.stats[stat]}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "#2a1f0e" }}>
                    <div
                      className="h-full rounded-full progress-bar"
                      data-width={`${cls.stats[stat]}%`}
                      style={{ background: `linear-gradient(90deg, ${statColors[stat]}80, ${statColors[stat]})` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
