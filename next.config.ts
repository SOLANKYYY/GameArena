import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/**": ["./certs/supabase-root-2021.crt"] },
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
