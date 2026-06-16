/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Prevent Next.js from trying to statically prerender API routes at build time.
  // All API routes in this app query the database and must be dynamic.
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

module.exports = nextConfig;
