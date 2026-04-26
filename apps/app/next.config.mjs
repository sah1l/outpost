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
  async headers() {
    return [
      {
        // Firebase Auth's signInWithPopup needs to read window.opener and call
        // window.close on the popup. Recent Chromium enforces COOP and blocks
        // cross-origin popup access unless we explicitly opt into the
        // popup-friendly variant.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
