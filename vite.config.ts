import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

const BUILD_TIMESTAMP = Date.now();

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

function writeVersionFile(): Plugin {
  return {
    name: "write-version-file",
    apply: "build",
    closeBundle() {
      const distPath = path.resolve(__dirname, "dist");
      if (!fs.existsSync(distPath)) fs.mkdirSync(distPath, { recursive: true });

      fs.writeFileSync(
        path.resolve(distPath, "version.json"),
        JSON.stringify(
          {
            buildTimestamp: BUILD_TIMESTAMP,
            buildId: String(BUILD_TIMESTAMP),
            version: String(BUILD_TIMESTAMP),
            appName: "WMCFLIX",
            displayVersionSource: "auto-build",
          },
          null,
          2,
        ),
        "utf-8",
      );

      console.log("[write-version-file] version.json criado para atualização obrigatória");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
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
      includeAssets: ["favicon.ico", "pwa-192.png", "pwa-512.png", "pwa-maskable-512.png", "apple-touch-icon.png"],
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/version\.json/, /^\/manifest\.webmanifest/],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff2}"],
        globIgnores: ["**/push-sw.js", "**/service-worker.js"],
        runtimeCaching: [
          {
            urlPattern: /\/version\.json/,
            handler: "NetworkOnly",
            options: {
              cacheName: "version-check",
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-public-images",
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "local-images",
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        id: "/wmcflix-pwa",
        name: "WMCFLIX",
        short_name: "WMCFLIX",
        description: "WMCFLIX - Programa Oficial de Fidelidade",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        display_override: ["standalone", "fullscreen"],
        orientation: "portrait",
        start_url: "/?source=pwa",
        scope: "/",
        categories: ["entertainment", "utilities"],
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Início",
            short_name: "Início",
            description: "Abrir início do app",
            url: "/dashboard",
            icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "AO VIVO",
            short_name: "AO VIVO",
            description: "Abrir TV ao vivo",
            url: "/tv-guide",
            icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
    }),
    writeVersionFile(),
    prependPushToSW(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
