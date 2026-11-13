import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

/* Waitlist storage.
 *
 * DURABLE (preferred): when WAITLIST_SUPABASE_URL and
 * WAITLIST_SUPABASE_ANON_KEY are set in the environment, signups are
 * inserted into the Supabase table `public.waitlist_signups`
 * (email, source, created_at; unique on (email, source)) via PostgREST.
 * The anon key is bound by row-level security to INSERT-only on that
 * one table — it can add signups but never read, update or delete
 * them. A repeat signup is ignored by the unique constraint, which is
 * exactly the dedupe behaviour this route has always had.
 *
 * FALLBACK (stopgap — only when those env vars are absent, or the
 * durable insert fails): a JSON file in os.tmpdir(). On Vercel
 * serverless /tmp is ephemeral: signups survive on a single warm
 * instance but can be lost on redeploy. The fallback exists so a
 * signup is never refused because storage hiccuped; it is NOT the
 * durable store and is labelled as such wherever it is used.
 */
const DATA_FILE = path.join(os.tmpdir(), "emboogway-waitlist.json");

type Entry = { email: string; source: string; createdAt: string };

function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.WAITLIST_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.WAITLIST_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

/** Insert into the durable store. Returns true when the signup is
    durably recorded (inserted, or already present — a duplicate is a
    successful no-op), false when durable storage is not configured or
    the insert failed (the caller then falls back to the stopgap file). */
async function storeInSupabase(email: string, source: string): Promise<boolean> {
  const cfg = supabaseConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/waitlist_signups?on_conflict=email,source`, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify([{ email, source }]),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`waitlist: durable insert failed (HTTP ${res.status}); using fallback file`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("waitlist: durable insert errored; using fallback file", err);
    return false;
  }
}

async function readAll(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function storeInFallbackFile(email: string, source: string): Promise<void> {
  const entries = await readAll();
  if (!entries.some((e) => e.email === email && e.source === source)) {
    entries.push({ email, source, createdAt: new Date().toISOString() });
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
  }
}

export async function POST(request: Request) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 80) : "unknown";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!(await storeInSupabase(email, source))) {
    await storeInFallbackFile(email, source);
  }

  return NextResponse.json({
    ok: true,
    message: "You're on the list. We'll email you when there's news.",
  });
}
