/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
  transpilePackages: ["@offsprint/shared"],
  poweredByHeader: false,
};

export default nextConfig;
