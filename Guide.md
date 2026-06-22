# Slack App Setup Guide

This guide walks you through creating and configuring the Slack app at https://api.slack.com/apps for the PR Review Tracker bot.

---

## Step 1: Create a New Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App**
3. Select **From scratch**
4. Enter an app name (e.g. `PR Review Tracker`)
5. Select the workspace where you want to install the bot
6. Click **Create App**

You will land on the **Basic Information** page for your new app.

---

## Step 2: Configure Bot Token Scopes

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll down to the **Scopes** section
3. Under **Bot Token Scopes**, click **Add an OAuth Scope** and add each of the following:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Post PR messages to channels |
| `commands` | Register the `/pr` slash command |
| `reactions:write` | Add/remove emoji reactions on messages |
| `channels:read` | Access public channel info |
| `groups:read` | Access private channel info |

---

## Step 3: Create the Slash Command

1. In the left sidebar, click **Slash Commands**
2. Click **Create New Command**
3. Fill in the form:
   - **Command:** `/pr`
   - **Request URL:** `https://<your-server-domain>/slack/events`
   - **Short Description:** `Submit a GitHub PR for review tracking`
   - **Usage Hint:** `https://github.com/org/repo/pull/123`
4. Click **Save**

> **Note:** If you are developing locally, you will need a public URL. See [Appendix A: ngrok Setup](#appendix-a-ngrok-setup) or Step 6 for a Socket Mode alternative.

---

## Step 4: Install the App to Your Workspace

1. In the left sidebar, click **Install App** (or go back to **OAuth & Permissions**)
2. Click **Install to Workspace**
3. Review the permissions and click **Allow**
4. After authorization, you will be redirected back and shown the **Bot User OAuth Token** (starts with `xoxb-`)
5. Copy this token -- you will need it for your `.env` file

---

## Step 5: Copy the Signing Secret

1. In the left sidebar, click **Basic Information**
2. Under **App Credentials**, find **Signing Secret**
3. Click **Show** and copy the value

This is used to verify that incoming requests to your server actually come from Slack.

---

## Step 6 (Optional): Enable Socket Mode for Local Development

Socket Mode allows your app to receive slash command payloads over a WebSocket connection instead of requiring a public HTTP endpoint. This is useful for local development.

1. In the left sidebar, click **Socket Mode**
2. Toggle **Enable Socket Mode** to on
3. You will be prompted to generate an **App-Level Token**:
   - Name it `development` (or any name you prefer)
   - Add the scope `connections:write`
   - Click **Generate**
4. Copy the generated token (starts with `xapp-`)

> **Note:** When Socket Mode is enabled, the Request URL you set for the slash command is ignored -- Slack routes everything over the WebSocket instead.

If you use Socket Mode, update your app initialization to use Socket Mode. In `src/index.ts`, replace the `ExpressReceiver` setup with:

```typescript
const app = new App({
  token: config.slack.botToken,
  appToken: config.slack.appToken,
  socketMode: true,
});
```

You will still need the Express server running for GitHub webhooks, so you would start Express separately in that case.

---

## Step 7: Configure Your Environment

Copy `.env.example` to `.env` and fill in the values from the steps above:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# From Step 4 - Bot User OAuth Token
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# From Step 5 - Signing Secret
SLACK_SIGNING_SECRET=your-signing-secret-here

# From Step 6 (only if using Socket Mode)
SLACK_APP_TOKEN=xapp-your-app-token-here
```

---

## Step 8: Invite the Bot to a Channel

The bot can only post messages and add reactions in channels where it is a member.

1. Open the Slack channel where you want to use `/pr`
2. Type `/invite @PR Review Tracker` (or whatever you named your app)
3. Alternatively, click the channel name > **Integrations** > **Add apps**

---

## Step 9: Test the Slash Command

1. In the channel where you invited the bot, type:
   ```
   /pr https://github.com/your-org/your-repo/pull/1
   ```
2. You should see the bot post a formatted PR message with an `eyes` reaction

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `dispatch_failed` when using `/pr` | Your Request URL is unreachable. Verify your server is running and publicly accessible, or enable Socket Mode. |
| `not_in_channel` error | Invite the bot to the channel (Step 8). |
| `invalid_auth` error | Double-check your `SLACK_BOT_TOKEN` in `.env`. |
| Command not appearing | Reinstall the app (OAuth & Permissions > Reinstall to Workspace). |

---

## Summary of Tokens Needed

| Token | Starts with | Where to find |
|-------|-------------|---------------|
| Bot Token | `xoxb-` | OAuth & Permissions page |
| Signing Secret | (hex string) | Basic Information > App Credentials |
| App-Level Token | `xapp-` | Basic Information > App-Level Tokens (Socket Mode only) |

---

## Appendix A: ngrok Setup

ngrok creates a public tunnel to your local machine so that Slack and GitHub can reach your server during development.

### Install ngrok

**macOS (Homebrew):**

```bash
brew install ngrok
```

**Other platforms:** Download from https://ngrok.com/download

Verify the installation:

```bash
ngrok version
```

### Authenticate ngrok

1. Sign up or log in at https://dashboard.ngrok.com/signup
2. Go to https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy your auth token and run:

```bash
ngrok config add-authtoken <YOUR_AUTH_TOKEN>
```

### Start the Tunnel

Make sure your bot server is running first (`npm run dev` or `npm start`), then in a separate terminal:

```bash
ngrok http 3000
```

ngrok will display output like:

```
Session Status    online
Forwarding        https://a1b2c3d4.ngrok-free.app -> http://localhost:3000
```

Copy the `https://...ngrok-free.app` URL. This is your public base URL.

### Update Your URLs

Use the ngrok URL in two places:

| Service | URL |
|---------|-----|
| Slack slash command Request URL (Step 3) | `https://a1b2c3d4.ngrok-free.app/slack/events` |
| GitHub App webhook URL | `https://a1b2c3d4.ngrok-free.app/github/webhooks` |

To update the Slack slash command URL:

1. Go to https://api.slack.com/apps and select your app
2. Click **Slash Commands** in the sidebar
3. Click the pencil icon next to `/pr`
4. Replace the **Request URL** with your new ngrok URL
5. Click **Save**

### Important Notes

- The ngrok URL **changes every time** you restart it (free plan). You will need to update the Slack and GitHub webhook URLs each time.
- If you are on a paid ngrok plan, you can reserve a static domain to avoid this:
  ```bash
  ngrok http --domain=your-static-domain.ngrok-free.app 3000
  ```
- Keep the ngrok terminal session running for the entire duration of your development session. Closing it kills the tunnel.

---

## Appendix B: GitHub App Setup

This bot uses a GitHub App to fetch PR details and receive webhook events. Follow these steps to create and configure one.

### B1: Create a New GitHub App

1. Go to https://github.com/settings/apps (for a personal account)
   - For an organization, go to `https://github.com/organizations/<your-org>/settings/apps`
2. Click **New GitHub App**
3. Fill in the required fields:
   - **GitHub App name:** `PR Review Tracker` (must be globally unique)
   - **Homepage URL:** `https://github.com` (or any URL -- this is just a required field)

### B2: Configure the Webhook

1. Make sure **Active** is checked under the Webhook section
2. Set the **Webhook URL** to your public server URL:
   ```
   https://a1b2c3d4.ngrok-free.app/github/webhooks
   ```
   Replace with your actual ngrok or production URL.
3. Set a **Webhook secret** -- this can be any random string. Generate one with:
   ```bash
   openssl rand -hex 20
   ```
4. Save this secret -- you will need it for your `.env` file as `GITHUB_WEBHOOK_SECRET`

### B3: Set Repository Permissions

Under **Permissions & events** > **Repository permissions**, set the following:

| Permission | Access |
|------------|--------|
| Contents | Read-only |
| Issues | Read-only |
| Metadata | Read-only |
| Pull requests | Read-only |

### B4: Subscribe to Webhook Events

Still under **Permissions & events**, scroll down to **Subscribe to events** and check:

- [x] **Issue comment**
- [x] **Pull request**
- [x] **Pull request review**
- [x] **Pull request review comment**

### B5: Set Where the App Can Be Installed

Under **Where can this GitHub App be installed?**, select:

- **Only on this account** (recommended for internal use)

### B6: Create the App

Click **Create GitHub App**. You will land on the app's settings page.

### B7: Note the App ID

On the app settings page at the top, you will see the **App ID** (a numeric value). Copy this -- you will need it for your `.env` file as `GITHUB_APP_ID`.

### B8: Generate a Private Key

1. Scroll down to the **Private keys** section
2. Click **Generate a private key**
3. A `.pem` file will be downloaded to your machine
4. Move it into your project root:
   ```bash
   mv ~/Downloads/<your-app-name>.*.private-key.pem ./private-key.pem
   ```
5. This file path goes in your `.env` as `GITHUB_PRIVATE_KEY_PATH`

> **Important:** Never commit the `.pem` file to version control. It is already in `.gitignore`.

### B9: Install the App on Your Repository

1. From your GitHub App settings page, click **Install App** in the left sidebar
2. Click **Install** next to your account or organization
3. Choose either:
   - **All repositories** -- the app can access all repos
   - **Only select repositories** -- pick the specific repos you want to track PRs for
4. Click **Install**

### B10: Update Your Environment

Add the GitHub values to your `.env` file:

```env
# From Step B7 - App ID (numeric)
GITHUB_APP_ID=123456

# From Step B8 - Path to the downloaded .pem file
GITHUB_PRIVATE_KEY_PATH=./private-key.pem

# From Step B2 - The webhook secret you generated
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

### Complete `.env` Reference

After completing both Slack and GitHub setup, your `.env` should look like this:

```env
# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# GitHub
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Server
PORT=3000
```
