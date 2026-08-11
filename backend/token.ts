import * as fs from "fs";
import * as process from "process";
import logger from "./logger.js";
import api from "../shared/common/api.js";

// Token env file path in render.com: All secret files you create are available to read at the root of your repo.
const ENV_PATH_IN_RENDER = "./token.env";
// For local dev, you need to pass the ENVPATH value in env variables.
// e.g. ENVPATH=PATH_TO_YOUR_FILE pnpm dev
// For production, we set a token.env file in render.com,
// and the copy of the file is stored at https://github.com/bytebase/secret/tree/master/token/star-history.
const envFilePath = process.env.ENVPATH || ENV_PATH_IN_RENDER;

const savedTokens: string[] = [];
let index = 0;
let configuredTokenCount = 0;
let tokenSource: "GITHUB_TOKENS" | "GITHUB_TOKEN" | "file" | "none" = "none";

// Tokens that hit rate limit are cooled down for 15 minutes.
const COOLDOWN_MS = 15 * 60 * 1000;
const exhaustedUntil = new Map<string, number>();

// Parse raw token text (newline or comma separated) into a token list.
const parseTokens = (raw: string): string[] =>
  raw
    .split(/[\r\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

const loadConfiguredTokens = (): string[] => {
  // Serverless platforms (e.g. Vercel) inject secrets via env variables instead of files.
  // Use GITHUB_TOKENS (comma separated) or GITHUB_TOKEN there.
  if (process.env.GITHUB_TOKENS) {
    tokenSource = "GITHUB_TOKENS";
    return parseTokens(process.env.GITHUB_TOKENS);
  }
  if (process.env.GITHUB_TOKEN) {
    tokenSource = "GITHUB_TOKEN";
    return parseTokens(process.env.GITHUB_TOKEN);
  }
  if (!fs.existsSync(envFilePath)) {
    throw new Error(`Token file not found with path ${envFilePath}`);
  }
  tokenSource = "file";
  return parseTokens(fs.readFileSync(envFilePath).toString());
};

// 2026-08: Vercel must validate injected secrets during cold start. The old
// lazy loader accepted stale/invalid values and later cached GitHub 404s as
// empty charts, making deployment configuration failures look like chart bugs.
export const initTokens = async () => {
  if (savedTokens.length > 0) {
    return;
  }
  const tokenList = loadConfiguredTokens();
  configuredTokenCount = tokenList.length;
  if (configuredTokenCount === 0) {
    throw new Error("No GitHub token configured");
  }

  // Validate authentication only. Stargazer access is repository-specific and
  // is verified against the repositories requested by each chart.
  for (const token of tokenList) {
    try {
      await api.getAuthenticatedUser(token);
      savedTokens.push(token);
    } catch (error: any) {
      const status = error?.response?.status ?? "unknown";
      logger.error(`A configured GitHub token is unusable (GitHub status: ${status})`);
    }
  }

  if (savedTokens.length === 0) {
    throw new Error("No usable GitHub token configured");
  }

  logger.info(`Usable token amount: ${savedTokens.length}`);
};

export const initTokenFromEnv = async () => {
  try {
    await initTokens();
  } catch (error) {
    logger.error("Failed to initialize GitHub tokens", error);
    process.exit(-1);
  }
};

export const getTokenStatus = () => ({
  source: tokenSource,
  configuredCount: configuredTokenCount,
  usableCount: savedTokens.length,
});

// Mark a token as rate-limited so it is skipped for COOLDOWN_MS.
export const markTokenExhausted = (token: string) => {
  exhaustedUntil.set(token, Date.now() + COOLDOWN_MS);
  logger.warn(`A GitHub token was rate-limited, cooling down for ${COOLDOWN_MS / 60000}m`);
};

// Get the next available token, skipping rate-limited ones.
// Returns null if all tokens are exhausted.
export const getNextToken = (): string | null => {
  const now = Date.now();
  for (let i = 0; i < savedTokens.length; i++) {
    index = (index + 1) % savedTokens.length;
    const token = savedTokens[index];
    const until = exhaustedUntil.get(token);
    if (!until || now >= until) {
      if (until) exhaustedUntil.delete(token);
      return token;
    }
  }
  return null;
};
