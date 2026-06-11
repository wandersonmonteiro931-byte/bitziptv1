import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

/**
 * Custom Vite plugin that prepends push notification handler code
 * to the generated sw.js AFTER the build completes.
 * This ensures the push handler is registered synchronously at the
 * TOP LEVEL of the service worker, before any Workbox module loading.
 */
function prependPushToSW(): Plugin {
  return {
    name: "prepend-push-to-sw",
    apply: "build",
    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        const swPath = path.resolve(__dirname, "dist/sw.js");
        if (!fs.existsSync(swPath)) {
          console.warn("[prepend-push-to-sw] sw.js not found in dist/");
          return;
        }

        const pushCode = fs.readFileSync(path.resolve(__dirname, "public/push-sw.js"), "utf-8");
        const existingSW = fs.readFileSync(swPath, "utf-8");

        // Prepend push handler code before the workbox code
        fs.writeFileSync(swPath, pushCode + "\n\n" + existingSW, "utf-8");
        console.log("[prepend-push-to-sw] ✅ Push handler prepended to sw.js");
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      includeAssets: ["logo-bitz.jpg", "favicon.ico"],
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2}"],
        globIgnores: ["**/push-sw.js", "**/service-worker.js"],
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: "Bitz IPTV",
        short_name: "Bitz IPTV",
        description: "Bitz IPTV - Programa de Fidelidade",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/logo-bitz.jpg",
            sizes: "192x192",
            type: "image/jpeg",
            purpose: "any",
          },
          {
            src: "/logo-bitz.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any",
          },
          {
            src: "/logo-bitz.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "maskable",
          },
        ],
      },
    }),
    prependPushToSW(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
