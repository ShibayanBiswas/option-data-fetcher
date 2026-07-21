import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  // Smaller runtime image for VPS / Docker deploys
  output: "standalone",
  // Never file-trace the multi‑GB SQLite / CSV archive into the build.
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingExcludes: {
    "*": [
      "./data/**",
      "./data/**/*",
      "data/**",
      "**/option_chain.db",
      "**/option_chain.db-*",
    ],
  },
};

export default nextConfig;
