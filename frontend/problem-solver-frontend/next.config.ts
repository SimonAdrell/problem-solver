import type { NextConfig } from "next";

if (!process.env.FLASK_URL) {
  throw new Error("FLASK_URL env var is not set (see .env)");
}

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.FLASK_URL}/api/:path*` }]
  }
};


export default nextConfig;
