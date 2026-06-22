import { App } from "@slack/bolt";
import { config } from "./config";
import { parseGitHubPRUrl } from "./github";
import { getOctokit } from "./github";
import { insertTrackedPR, findByGitHubPR } from "./database";

export function registerSlashCommand(app: App): void {
  app.command("/pr", async ({ command, ack, respond, client }) => {
    await ack();

    const url = command.text.trim();

    // Validate URL
    const parsed = parseGitHubPRUrl(url);
    if (!parsed) {
      await respond({
        response_type: "ephemeral",
        text: "Please provide a valid GitHub Pull Request URL.",
      });
      return;
    }

    const { owner, repo, prNumber } = parsed;
    const fullRepo = `${owner}/${repo}`;

    // Check for duplicate
    const existing = findByGitHubPR(fullRepo, prNumber);
    if (existing) {
      await respond({
        response_type: "ephemeral",
        text: "This PR is already being tracked.",
      });
      return;
    }

    // Fetch PR details from GitHub
    let prData;
    try {
      const octokit = await getOctokit(owner, repo);
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      prData = data;
    } catch (error) {
      await respond({
        response_type: "ephemeral",
        text: "Unable to access this Pull Request. Verify the repository is accessible by the GitHub App.",
      });
      return;
    }

    // Truncate description
    let description = prData.body || "";
    if (description.length > 200) {
      description = description.substring(0, 200) + "...";
    }

    // Post message to channel
    const messageText = [
      "🚀 PR Ready For Review",
      "",
      `*${prData.title}*`,
      "",
      description,
      "",
      `👤 Submitted by <@${command.user_id}>`,
      "",
      `🔗 ${url}`,
    ].join("\n");

    const result = await client.chat.postMessage({
      channel: command.channel_id,
      text: messageText,
    });

    if (!result.ts) {
      await respond({
        response_type: "ephemeral",
        text: "Failed to post message to channel.",
      });
      return;
    }

    // Add initial 👀 reaction
    await client.reactions.add({
      channel: command.channel_id,
      timestamp: result.ts,
      name: "eyes",
    });

    // Save mapping
    insertTrackedPR({
      github_pr_id: prNumber,
      github_repo: fullRepo,
      slack_channel_id: command.channel_id,
      slack_message_ts: result.ts,
      created_by_slack_user: command.user_id,
    });
  });
}
