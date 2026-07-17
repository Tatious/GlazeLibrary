import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// In production `publicDir` is false (keeps the multi-MB public/images tree
// out of dist/), so Vite doesn't copy the PWA files. Copy just the small PWA
// asset set into dist/ so the manifest, icons and service worker ship and are
// served from stable, same-origin root paths.
function copyPwaAssets(): Plugin {
  const files = [
    "manifest.webmanifest",
    "apple-touch-icon.png",
    "sw.js",
    "icon.svg",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
  ];
  return {
    name: "copy-pwa-assets",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(rootDir, "dist");
      for (const rel of files) {
        const src = path.resolve(rootDir, "public", rel);
        if (!fs.existsSync(src)) continue;
        const dest = path.resolve(outDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    },
  };
}

// All /api/* requests are proxied to the Express server (server/index.js).
// /api/config used to be served by a dev-only Vite middleware that wrote to
// src/config/my-glazes.json; that file (and the global-config bug it caused)
// have been replaced by the SQLite-backed /api/config route.
const apiProxy = {
  target: "http://localhost:3001",
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react(), copyPwaAssets()],
  // Don't copy large static assets - they're served from Azure CDN in production
  publicDir: process.env.NODE_ENV === "production" ? false : "public",
  server: {
    proxy: {
      "/api/upload": apiProxy,
      "/api/user-combinations": apiProxy,
      "/api/collections": apiProxy,
      "/api/pieces": apiProxy,
      "/api/admin": apiProxy,
      "/api/auth": apiProxy,
      "/api/config": apiProxy,
      "/api/inventory": apiProxy,
      "/api/profile": apiProxy,
      "/api/account": apiProxy,
      "/uploads": apiProxy,
    },
  },
});
