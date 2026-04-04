"use client";
import { useEffect, useRef } from "react";

export default function Particles({ color = "gold", count = 20 }: { color?: "gold" | "green"; count?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const x = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 60;
      const duration = 4 + Math.random() * 8;
      const delay = Math.random() * 8;
      p.style.cssText = `
        left: ${x}%;
        bottom: ${Math.random() * 30}%;
        --drift: ${drift}px;
        --duration: ${duration}s;
        --delay: ${delay}s;
        background: ${color === "green" ? "rgba(74,154,62,0.6)" : "rgba(201,150,58,0.6)"};
        width: ${1 + Math.random() * 2}px;
        height: ${1 + Math.random() * 2}px;
      `;
      container.appendChild(p);
    }
  }, [color, count]);

  return <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none" />;
}
