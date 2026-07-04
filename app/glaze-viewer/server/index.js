/**
 * Express server entry point.
 *
 * Responsibilities here:
 *   - App-level middleware (CORS, JSON, static)
 *   - Storage init + one-time JSON migrations
 *   - Mount per-resource routers from ./routes/*
 *   - Error handler + SPA fallback in production
 *
 * Per-route logic lives under ./routes/. Shared helpers are under ./lib/ and
 * ./middleware/.
 */

import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

import {
  initAzureStorage,
  useAzureStorage,
  isAzure,
} from "./storage.js";
import { Inventory, Migrations } from "./lib/repositories.js";

import authRoutes from "./routes/auth.js";
import configRoutes from "./routes/config.js";
import inventoryRoutes from "./routes/inventory.js";
import uploadRoutes from "./routes/uploads.js";
import collectionsRoutes from "./routes/collections.js";
import piecesRoutes from "./routes/pieces.js";
import profileRoutes from "./routes/profile.js";
import adminRoutes from "./routes/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production" || isAzure;

console.log(`Server mode: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);

// CORS origin policy. In production we REFUSE to start without an explicit
// allowlist so a missing env var can never silently open the API to any
// origin. In development we accept any origin so Vite dev server + LAN
// devices can hit the API.
let corsOrigin;
if (isProduction) {
  const allowed = process.env.ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed || allowed.length === 0) {
    console.error(
      "FATAL: ALLOWED_ORIGINS must be set (comma-separated) in production.",
    );
    process.exit(1);
  }
  corsOrigin = allowed;
} else {
  corsOrigin = true;
}

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Always serve uploaded files locally (avoids Vite 404 cache in dev).
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../public/uploads")),
);

if (isProduction) {
  const distPath = path.join(__dirname, "../dist");
  const publicPath = path.join(__dirname, "../public");
  app.use(express.static(distPath));
  app.use(express.static(publicPath));
  console.log(`Serving static files from: ${distPath}`);
  console.log(`Serving public files from: ${publicPath}`);
}

// Liveness probe (no auth). deploy.sh polls this after a push to confirm the
// Node server — not just the static SPA — is actually up.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: isProduction ? "production" : "development" });
});

// =============================================================================
// Routers
// =============================================================================

app.use("/api/auth", authRoutes);
// /api/account is owned by auth router but lives at root-level path for legacy.
app.use("/api", authRoutes);

app.use("/api/config", configRoutes);
app.use("/api/inventory", inventoryRoutes);

// /api/upload + /api/user-combinations both live under the uploads router.
app.use("/api", uploadRoutes);

// /api/collections is canonical. The legacy /api/user-projects mount was
// dropped in Phase 4 — the client uses /api/collections and accepts only the
// `collection` / `collections` envelope keys.
app.use("/api/collections", collectionsRoutes);

app.use("/api/pieces", piecesRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);

// =============================================================================
// Error handler + SPA fallback
// =============================================================================

// Multer errors get a friendlier response than 500.
app.use((error, req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large." });
    }
  }
  res.status(500).json({ error: error.message });
});

if (isProduction) {
  const distPath = path.join(__dirname, "../dist");
  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// =============================================================================
// Startup
// =============================================================================

async function startServer() {
  try {
    if (useAzureStorage) {
      await initAzureStorage();
    }
    // One-shot migrations (all idempotent via schema_migrations).
    Migrations.addPieceWeightColumn();
    Migrations.addResourceMembersTable();
    // One-shot: seed the shared inventory table from any existing per-user
    // `my_glazes` rows. Idempotent (tracked in schema_migrations).
    Inventory.seedFromMyGlazes();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(
        `Environment: ${isProduction ? "production" : "development"}`,
      );
      console.log(
        `Storage: ${useAzureStorage ? "Azure Blob Storage" : "Local File System"}`,
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
