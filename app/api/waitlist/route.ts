import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

// STOPGAP: stores signups in a JSON file on the server.
// On Vercel serverless, only /tmp is writable and it is ephemeral —
// signups survive on a single warm instance but can be lost on redeploy.
// Connect a real backend (Supabase table, ConvertKit/Buttondown, etc.)
// before relying on this for a launch.
const DATA_FILE = path.join(os.tmpdir(), "emboogway-waitlist.json");

type Entry = { email: string; source: string; createdAt: string };

async function readAll(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

  const entries = await readAll();
  if (!entries.some((e) => e.email === email && e.source === source)) {
    entries.push({ email, source, createdAt: new Date().toISOString() });
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
  }

  return NextResponse.json({
    ok: true,
    message: "You're on the list. We'll email you when there's news.",
  });
}
