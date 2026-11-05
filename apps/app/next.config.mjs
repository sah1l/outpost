/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
    // Requests passing through middleware are buffered, and anything past this limit is silently
    // cut off. The default is exactly 10 MB, which is our upload limit before multipart overhead.
    middlewareClientMaxBodySize: "11mb",
  },
  transpilePackages: ["@offsprint/shared"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Firebase Auth's signInWithPopup needs to read window.opener and call
          // window.close on the popup. Recent Chromium enforces COOP and blocks
          // cross-origin popup access unless we explicitly opt into the
          // popup-friendly variant.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // Stops other pages framing the app and tricking someone into clicking Approve on
          // the CLI device page. The doc viewer frames usercontent, never the other way round.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
