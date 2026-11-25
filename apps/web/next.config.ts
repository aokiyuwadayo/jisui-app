import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jisui/core", "@jisui/backend"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
