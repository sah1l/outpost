/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@offsprint/shared"],
  poweredByHeader: false,
};

export default nextConfig;
