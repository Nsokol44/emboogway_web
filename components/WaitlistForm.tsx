"use client";

import { useState } from "react";

export default function WaitlistForm({ source, cta = "NOTIFY ME" }: { source: string; cta?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setState("done");
      setMessage(data.message || "You're on the list. We'll be in touch.");
      setEmail("");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (state === "done") {
    return (
      <p className="font-display text-sm tracking-widest text-gold-light bg-gold/10 border border-gold/30 rounded px-6 py-4 max-w-md mx-auto">
        ✓ {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        aria-label="Email address"
        className="flex-1 px-4 py-3 rounded text-sm bg-bark border border-gold/30 text-cream placeholder-gold-dim/50 outline-none focus:border-gold transition-colors"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="btn-shimmer px-6 py-3 rounded text-sm disabled:opacity-50"
      >
        {state === "sending" ? "SENDING…" : cta}
      </button>
      {state === "error" && message && (
        <p className="text-xs text-ember sm:w-full text-center">{message}</p>
      )}
    </form>
  );
}
