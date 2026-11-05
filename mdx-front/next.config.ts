import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "mdx26.fabitz.com.br" }],
        destination: "https://mdx26.mermasdigitais.com.br/:path*",
        permanent: true,
      },
      { source: "/", destination: "/e/mdx-2026", permanent: false },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Um orientador e até 5 integrantes, cada documento com até 5 MB.
      bodySizeLimit: "32mb",
    },
  },
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
