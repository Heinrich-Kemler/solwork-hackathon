import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: "/api/actions/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Action-Version", value: "1" },
          { key: "X-Blockchain-Ids", value: "solana:devnet" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
