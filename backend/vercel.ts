import { Hono } from "hono";
import { initTokens } from "./token.js";
import { initOgAssets } from "./og-card.js";
import { loadRepos } from "../shared/common/repo-data.js";
import { createApp } from "./app.js";

// Serverless entry point shared by the Next.js API routes on Vercel.
// 2026-08: initialization is asynchronous so an injected GitHub token is
// authenticated once per cold start before any response can be cached.
let appPromise: Promise<Hono> | null = null;

export const getVercelApp = (): Promise<Hono> => {
  if (!appPromise) {
    appPromise = (async () => {
      await initTokens();
      try {
        initOgAssets();
      } catch (error) {
        // OG card assets are optional; only style=landscape1 needs them.
        console.warn("Failed to init OG assets:", error);
      }
      return createApp(loadRepos());
    })();
  }
  return appPromise;
};
