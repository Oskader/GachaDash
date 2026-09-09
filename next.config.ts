import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import path from "node:path";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en el home del usuario; sin esto Next
  // infiere C:\Users\oscar como raíz del workspace y el build tracing sale mal.
  outputFileTracingRoot: path.join(__dirname),

  images: {
    // games.icon_url es una URL arbitraria de la BD. Sin remotePatterns,
    // next/image lanza "Invalid src prop" en cuanto una fila deje de ser null.
    remotePatterns: [
      { protocol: "https", hostname: "**.fandom.com" },
      { protocol: "https", hostname: "**.wiki.gg" },
      { protocol: "https", hostname: "**.nocookie.net" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "cdn.prydwen.gg" },
    ],
    // Whitelist de qualities: Next 16 degrada silenciosamente cualquier prop
    // `quality` fuera de esta lista al primer valor (default: 75). La miniatura
    // de evento pide 90 explicita; sin esto la prop se ignora. Verificado en
    // node_modules/next/dist/docs/01-app/03-api-reference/04-components/image.md.
    qualities: [75, 90],
    // Orden de preferencia del formato de salida. AVIF retiene mejor el texto y
    // el detalle fino de los banners de HSR al mismo bitrate que webp; si el
    // navegador no soporta AVIF, cae a webp automaticamente.
    formats: ["image/avif", "image/webp"],
  },
};

export default withSerwist(nextConfig);