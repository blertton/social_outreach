import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(process.env.PLAYWRIGHT_TEST_BUILD === "1" ? {
    distDir: ".next-e2e",
    typescript: { tsconfigPath: "tsconfig.e2e.json" },
  } : {}),
};

export default nextConfig;
