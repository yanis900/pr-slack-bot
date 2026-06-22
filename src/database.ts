import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = path.join(process.cwd(), "pr-slack-bot.db");

let db: SqlJsDatabase;

function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tracked_prs (
      id TEXT PRIMARY KEY,
      github_pr_id INTEGER NOT NULL,
      github_repo TEXT NOT NULL,
      slack_channel_id TEXT NOT NULL,
      slack_message_ts TEXT NOT NULL,
      created_by_slack_user TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_tracked_prs_github
    ON tracked_prs (github_repo, github_pr_id)
  `);

  saveDatabase();
}

export interface TrackedPR {
  id: string;
  github_pr_id: number;
  github_repo: string;
  slack_channel_id: string;
  slack_message_ts: string;
  created_by_slack_user: string;
  created_at: string;
}

export function insertTrackedPR(params: {
  github_pr_id: number;
  github_repo: string;
  slack_channel_id: string;
  slack_message_ts: string;
  created_by_slack_user: string;
}): TrackedPR {
  const id = uuidv4();
  const created_at = new Date().toISOString();

  db.run(
    `INSERT INTO tracked_prs (id, github_pr_id, github_repo, slack_channel_id, slack_message_ts, created_by_slack_user, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, params.github_pr_id, params.github_repo, params.slack_channel_id, params.slack_message_ts, params.created_by_slack_user, created_at]
  );

  saveDatabase();

  return {
    id,
    ...params,
    created_at,
  };
}

export function findByGitHubPR(repo: string, prId: number): TrackedPR | undefined {
  const stmt = db.prepare(
    `SELECT * FROM tracked_prs WHERE github_repo = ? AND github_pr_id = ? LIMIT 1`
  );
  stmt.bind([repo, prId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as TrackedPR;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function findAllByGitHubPR(repo: string, prId: number): TrackedPR[] {
  const results: TrackedPR[] = [];
  const stmt = db.prepare(
    `SELECT * FROM tracked_prs WHERE github_repo = ? AND github_pr_id = ?`
  );
  stmt.bind([repo, prId]);

  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as TrackedPR);
  }
  stmt.free();
  return results;
}
