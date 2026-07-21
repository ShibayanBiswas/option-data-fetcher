import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  // Smaller runtime image for VPS / Docker deploys
  output: "standalone",
};

export default nextConfig;
