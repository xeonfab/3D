import path from "node:path";
import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Le dépôt contient d'autres lockfiles (SuperSplat, prototype Remotion).
  outputFileTracingRoot: path.join(__dirname),
  // Fichiers lus à l'exécution par les Server Actions (routage maritime).
  outputFileTracingIncludes: {
    "/app/products/[id]": ["./lib/geo/data/**", "./node_modules/searoute-js/data/**"],
  },
  serverExternalPackages: [
    "@remotion/lambda",
    "@remotion/bundler",
    "@remotion/renderer",
    "searoute-js",
  ],
  experimental: {
    serverActions: {
      // Upload de logos (2 Mo) et de photos (< 500 Ko après compression).
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
