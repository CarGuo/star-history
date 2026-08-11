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

// Tokens that hit rate limit are cooled down for 15 minutes.
const COOLDOWN_MS = 15 * 60 * 1000;
const exhaustedUntil = new Map<string, number>();

// Parse raw token text (newline or comma separated) into a token list.
const parseTokens = (raw: string): string[] =>
  raw
    .split(/[\r\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

export const initTokenFromEnv = async () => {
  // Serverless platforms (e.g. Vercel) inject secrets via env variables instead of files.
  // Use GITHUB_TOKENS (comma separated) or GITHUB_TOKEN there.
  const envTokens = process.env.GITHUB_TOKENS || process.env.GITHUB_TOKEN;
  let tokenList: string[];
  if (envTokens) {
    tokenList = parseTokens(envTokens);
  } else {
    if (!fs.existsSync(envFilePath)) {
      logger.error("Token file not found with path ", envFilePath);
      process.exit(-1);
    }
    const envTokenString = fs.readFileSync(envFilePath).toString();
    if (!envTokenString) {
      logger.error("Token not found");
      process.exit(-1);
    }
    tokenList = parseTokens(envTokenString);
  }

  // Call GitHub API to check token usability
  for (const token of tokenList) {
    try {
      await api.getRepoStargazersCount("star-history/star-history", token);
      savedTokens.push(token);
    } catch (error) {
      logger.error(`Token ${token.slice(0, 8)}...${token.slice(-4)} is unusable`, error);
    }
  }

  if (savedTokens.length === 0) {
    logger.error("No usable token");
    process.exit(-1);
  }

  logger.info(`Usable token amount: ${savedTokens.length}`);
};

// Lazily load tokens without validating them against the GitHub API.
// Intended for serverless environments where init must be cheap and
// process.exit would kill the whole runtime. Invalid tokens will simply
// be marked as exhausted when requests hit the rate limit.
export const initTokensLazy = () => {
  if (savedTokens.length > 0) {
    return;
  }
  const envTokens = process.env.GITHUB_TOKENS || process.env.GITHUB_TOKEN;
  if (envTokens) {
    savedTokens.push(...parseTokens(envTokens));
    return;
  }
  try {
    if (fs.existsSync(envFilePath)) {
      savedTokens.push(...parseTokens(fs.readFileSync(envFilePath).toString()));
    }
  } catch (error) {
    logger.error("Failed to load tokens lazily", error);
  }
};

// Mark a token as rate-limited so it is skipped for COOLDOWN_MS.
export const markTokenExhausted = (token: string) => {
  exhaustedUntil.set(token, Date.now() + COOLDOWN_MS);
  logger.warn(`Token ${token.slice(0, 8)}... rate-limited, cooling down for ${COOLDOWN_MS / 60000}m`);
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
