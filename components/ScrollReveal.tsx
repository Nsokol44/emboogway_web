"use client";
import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    // Scroll reveal observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add("visible"), i * 80);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale")
      .forEach(el => observer.observe(el));

    // Cursor glow
    const glow = document.getElementById("cursor-glow");
    const onMove = (e: MouseEvent) => {
      if (glow) {
        glow.style.left = e.clientX + "px";
        glow.style.top = e.clientY + "px";
      }
    };
    window.addEventListener("mousemove", onMove);

    // Animated counters
    const counters = document.querySelectorAll("[data-count]");
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const target = el.dataset.count || "0";
          const prefix = el.dataset.prefix || "";
          const suffix = el.dataset.suffix || "";
          const num = parseInt(target.replace(/\D/g, ""));
          let start = 0;
          const duration = 1800;
          const step = num / (duration / 16);
          const timer = setInterval(() => {
            start += step;
            if (start >= num) {
              start = num;
              clearInterval(timer);
            }
            el.textContent = prefix + Math.floor(start).toLocaleString() + suffix;
          }, 16);
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => countObserver.observe(el));

    // Animated progress bars
    const bars = document.querySelectorAll(".progress-bar[data-width]");
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const width = el.dataset.width || "0%";
          setTimeout(() => { el.style.width = width; }, 200);
          barObserver.unobserve(el);
        }
      });
    }, { threshold: 0.3 });
    bars.forEach(el => barObserver.observe(el));

    return () => {
      observer.disconnect();
      countObserver.disconnect();
      barObserver.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <div id="cursor-glow" className="cursor-glow hidden md:block" />;
}
