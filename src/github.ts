import { App as OctokitApp, Octokit } from "octokit";
import fs from "fs";
import { config } from "./config";

let githubApp: OctokitApp;

export function initGitHubApp(): void {
  const privateKey = fs.readFileSync(config.github.privateKeyPath, "utf-8");
  githubApp = new OctokitApp({
    appId: config.github.appId,
    privateKey,
    webhooks: { secret: config.github.webhookSecret },
  });
}

export async function getOctokit(owner: string, repo: string): Promise<Octokit> {
  const { data: installation } = await githubApp.octokit.rest.apps.getRepoInstallation({
    owner,
    repo,
  });
  return githubApp.getInstallationOctokit(installation.id);
}

export function getGitHubApp(): OctokitApp {
  return githubApp;
}

export interface ParsedPRUrl {
  owner: string;
  repo: string;
  prNumber: number;
}

export function parseGitHubPRUrl(url: string): ParsedPRUrl | null {
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/
  );
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
}
