import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dynamic server deployment (API routes enabled for the waitlist).
  // NOTE: the waitlist endpoint currently stores to a JSON file, which is
  // ephemeral on Vercel — connect a real backend (Supabase/ConvertKit)
  // before relying on it for a launch.
  trailingSlash: true,
  skipTrailingSlashRedirect: true, // lets API routes accept POSTs without a trailing slash
  images: { unoptimized: true },
};

export default nextConfig;
