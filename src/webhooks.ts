import { Request, Response, Router } from "express";
import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import { config } from "./config";
import { findAllByGitHubPR, TrackedPR } from "./database";

const router = Router();

function verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = "sha256=" + crypto
    .createHmac("sha256", config.github.webhookSecret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const slackClient = new WebClient(config.slack.botToken);

async function addReaction(tracked: TrackedPR, name: string): Promise<void> {
  try {
    await slackClient.reactions.add({
      channel: tracked.slack_channel_id,
      timestamp: tracked.slack_message_ts,
      name,
    });
  } catch (error: any) {
    // "already_reacted" is expected if reaction already exists
    if (error?.data?.error !== "already_reacted") {
      console.error(`Failed to add reaction ${name}:`, error);
    }
  }
}

async function removeReaction(tracked: TrackedPR, name: string): Promise<void> {
  try {
    await slackClient.reactions.remove({
      channel: tracked.slack_channel_id,
      timestamp: tracked.slack_message_ts,
      name,
    });
  } catch (error: any) {
    // "no_reaction" is expected if reaction doesn't exist
    if (error?.data?.error !== "no_reaction") {
      console.error(`Failed to remove reaction ${name}:`, error);
    }
  }
}

function extractRepo(payload: any): string {
  const repo = payload.repository;
  return `${repo.owner.login}/${repo.name}`;
}

async function handlePullRequestReview(payload: any): Promise<void> {
  const repo = extractRepo(payload);
  const prNumber = payload.pull_request.number;
  const review = payload.review;

  const trackedPRs = findAllByGitHubPR(repo, prNumber);
  if (trackedPRs.length === 0) return;

  for (const tracked of trackedPRs) {
    if (review.state === "approved") {
      await removeReaction(tracked, "x");
      await addReaction(tracked, "white_check_mark");
    } else if (review.state === "changes_requested") {
      await removeReaction(tracked, "white_check_mark");
      await addReaction(tracked, "x");
    }
  }
}

async function handleComment(payload: any): Promise<void> {
  const repo = extractRepo(payload);

  // For issue_comment, check if it's on a PR
  let prNumber: number;
  if (payload.pull_request) {
    prNumber = payload.pull_request.number;
  } else if (payload.issue?.pull_request) {
    prNumber = payload.issue.number;
  } else {
    return; // Not a PR comment
  }

  const trackedPRs = findAllByGitHubPR(repo, prNumber);
  if (trackedPRs.length === 0) return;

  for (const tracked of trackedPRs) {
    await addReaction(tracked, "speech_balloon");
  }
}

async function handlePullRequestClosed(payload: any): Promise<void> {
  const repo = extractRepo(payload);
  const prNumber = payload.pull_request.number;
  const merged = payload.pull_request.merged;

  const trackedPRs = findAllByGitHubPR(repo, prNumber);
  if (trackedPRs.length === 0) return;

  for (const tracked of trackedPRs) {
    if (merged) {
      await addReaction(tracked, "twisted_rightwards_arrows");
    } else {
      await addReaction(tracked, "no_entry_sign");
    }
  }
}

router.post("/github/webhooks", async (req: Request, res: Response) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const body = (req as any).rawBody || JSON.stringify(req.body);

  if (!verifyWebhookSignature(body, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.headers["x-github-event"] as string;
  const payload = req.body;

  try {
    switch (event) {
      case "pull_request_review":
        if (payload.action === "submitted") {
          await handlePullRequestReview(payload);
        }
        break;

      case "pull_request_review_comment":
        if (payload.action === "created") {
          await handleComment(payload);
        }
        break;

      case "issue_comment":
        if (payload.action === "created") {
          await handleComment(payload);
        }
        break;

      case "pull_request":
        if (payload.action === "closed") {
          await handlePullRequestClosed(payload);
        }
        break;
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
  }

  res.status(200).json({ ok: true });
});

export { router as webhookRouter };
