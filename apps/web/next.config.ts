import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@veda/contracts", "@veda/ui"],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    return [
      {
        source: "/api/uploadthing/:path*",
        destination: `${apiUrl}/api/uploadthing/:path*`,
      },
    ];
  },
};

export default nextConfig;
