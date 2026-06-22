import { App, ExpressReceiver } from "@slack/bolt";
import { config } from "./config";
import { initDatabase } from "./database";
import { initGitHubApp } from "./github";
import { registerSlashCommand } from "./slack";
import { webhookRouter } from "./webhooks";

async function main() {
  // Initialize database
  await initDatabase();

  // Initialize GitHub App
  initGitHubApp();

  // Create Express receiver for Slack Bolt + custom routes
  const receiver = new ExpressReceiver({
    signingSecret: config.slack.signingSecret,
  });

  // Register GitHub webhook routes on the Express app
  // We need raw body for signature verification
  receiver.router.use("/github/webhooks", (req, res, next) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      (req as any).rawBody = data;
      req.body = JSON.parse(data);
      next();
    });
  });
  receiver.router.use(webhookRouter);

  // Create Slack app
  const app = new App({
    token: config.slack.botToken,
    receiver,
  });

  // Register slash command
  registerSlashCommand(app);

  // Start server
  await app.start(config.port);
  console.log(`⚡ PR Slack Bot is running on port ${config.port}`);
  console.log(`   Slack: listening for /pr commands`);
  console.log(`   GitHub webhooks: POST http://localhost:${config.port}/github/webhooks`);
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
