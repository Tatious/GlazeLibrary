import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// All /api/* requests are proxied to the Express server (server/index.js).
// /api/config used to be served by a dev-only Vite middleware that wrote to
// src/config/my-glazes.json; that file (and the global-config bug it caused)
// have been replaced by the SQLite-backed /api/config route.
const apiProxy = {
  target: "http://localhost:3001",
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
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
