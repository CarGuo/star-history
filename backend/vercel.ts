import { Hono } from "hono";
import { initTokensLazy } from "./token.js";
import { initOgAssets } from "./og-card.js";
import { loadRepos, RepoStore } from "../shared/common/repo-data.js";
import { createApp } from "./app.js";

// Serverless entry point shared by the Next.js API routes on Vercel.
// Cold starts must be cheap and must never call process.exit, so tokens are
// loaded lazily from env vars and validated on first use instead of upfront.
let app: Hono | null = null;
let repoStore: RepoStore | null = null;

export const getVercelApp = (): Hono => {
  if (!app) {
    initTokensLazy();
    try {
      initOgAssets();
    } catch (error) {
      // OG card assets are optional; only style=landscape1 needs them.
      console.warn("Failed to init OG assets:", error);
    }
    repoStore = loadRepos();
    app = createApp(repoStore);
  }
  return app;
};
