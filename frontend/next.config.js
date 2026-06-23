/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Rewrites removed — API route handlers now proxy all /api/* requests
  // to the backend with proper cookie forwarding (essential for httpOnly Cookie auth)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api",
  },
};

module.exports = nextConfig;
