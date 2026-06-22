import dotenv from "dotenv";
dotenv.config();

export const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    appToken: process.env.SLACK_APP_TOKEN!,
  },
  github: {
    appId: process.env.GITHUB_APP_ID!,
    privateKeyPath: process.env.GITHUB_PRIVATE_KEY_PATH!,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
  },
  port: parseInt(process.env.PORT || "3000", 10),
};
