import { serve } from "@hono/node-server";
import logger from "./logger.js";
import { initTokenFromEnv } from "./token.js";
import { initOgAssets } from "./og-card.js";
import { loadRepos } from "../shared/common/repo-data.js";
import { createApp } from "./app.js";

const startServer = async () => {
  await initTokenFromEnv();
  initOgAssets();
  const repoStore = loadRepos();

  const app = createApp(repoStore);

  const banner = `
     _______.___________.    ___      .______          __    __   __       _______.___________.  ______   .______     ____    ____
    /       |           |   /   \\     |   _  \\        |  |  |  | |  |     /       |           | /  __  \\  |   _  \\    \\   \\  /   /
   |   (----\`---|  |----\`  /  ^  \\    |  |_)  |       |  |__|  | |  |    |   (----\`---|  |----\`|  |  |  | |  |_)  |    \\   \\/   /
    \\   \\       |  |      /  /_\\  \\   |      /        |   __   | |  |     \\   \\       |  |     |  |  |  | |      /      \\_    _/
.----)   |      |  |     /  _____  \\  |  |\\  \\----.   |  |  |  | |  | .----)   |      |  |     |  \`--'  | |  |\\  \\----.   |  |
|_______/       |__|    /__/     \\__\\ | _| \`._____|   |__|  |__| |__| |_______/       |__|      \\______/  | _| \`._____|   |__|
`;
  serve({ fetch: app.fetch, port: 8080 }, () => {
    console.log(banner);
    console.log(`  commit: ${process.env.GIT_COMMIT || "unknown"}\n`);
    logger.info("server running on port 8080");
  });
};

startServer();
