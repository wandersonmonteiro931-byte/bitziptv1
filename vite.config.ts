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
            appName: "WMCPLAYER",
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
  base: "/app/",
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
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      base: "/app/",
      scope: "/app/",
      strategies: "generateSW",
      registerType: "prompt",
      includeAssets: [
        "wmcplayer-favicon-v4.ico",
        "wmcplayer-icon-192-v4.png",
        "wmcplayer-icon-512-v4.png",
        "wmcplayer-maskable-512-v4.png",
        "wmcplayer-apple-touch-v4.png",
      ],
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/app/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/app\/install(?:\/|$)/,
          /^\/app\/version\.json/,
          /^\/app\/manifest\.webmanifest/,
        ],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff2}"],
        globIgnores: [
          "**/push-sw.js",
          "**/service-worker.js",
          "**/_headers",
          "**/_redirects",
          "**/placeholder.svg",
          "**/robots.txt",
          "**/apple-touch-icon.png",
          "**/favicon.ico",
          "**/pwa-192.png",
          "**/pwa-512.png",
          "**/pwa-maskable-512.png",
          "**/wmcplayer-favicon-v4.ico",
          "**/wmcplayer-icon-192-v4.png",
          "**/wmcplayer-icon-512-v4.png",
          "**/wmcplayer-maskable-512-v4.png",
          "**/wmcplayer-apple-touch-v4.png",
          "**/assets/index-*.js",
        ],
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
      manifest: false,
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
