import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const migration = `
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, niche TEXT NOT NULL, evidence_state TEXT NOT NULL CHECK(evidence_state IN ('UNVERIFIED','PHYSICALLY_TESTED')),
  status TEXT NOT NULL DEFAULT 'HYPOTHESIS', opportunity_score REAL, opportunity_dimensions_json TEXT, opportunity_reasoning_json TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS affiliate_programs (
  id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES products(id), name TEXT NOT NULL, program_type TEXT NOT NULL CHECK(program_type IN ('AMAZON','DIRECT','TIKTOK_SHOP')),
  destination_url TEXT, commission_percent REAL, expected_commission REAL, status TEXT NOT NULL DEFAULT 'DISCOVERED',
  clicks INTEGER NOT NULL DEFAULT 0, orders INTEGER NOT NULL DEFAULT 0, revenue REAL NOT NULL DEFAULT 0, commission REAL NOT NULL DEFAULT 0,
  money_status TEXT NOT NULL DEFAULT 'ESTIMATED' CHECK(money_status IN ('ESTIMATED','PENDING','CONFIRMED')), terms_reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_evidence (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, claim TEXT NOT NULL, source_url TEXT NOT NULL,
  source_title TEXT, verified_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, hypothesis TEXT NOT NULL, dimension TEXT NOT NULL, variants_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content_ideas (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), experiment_id INTEGER REFERENCES experiments(id), hook TEXT NOT NULL,
  angle TEXT NOT NULL, format TEXT NOT NULL, cta TEXT NOT NULL, concept TEXT NOT NULL, information_value REAL NOT NULL,
  experiment_tag TEXT NOT NULL CHECK(experiment_tag IN ('CONTROL','ITERATION','EXPERIMENT')), status TEXT NOT NULL DEFAULT 'DRAFT', skip_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS creative_candidates (
  id INTEGER PRIMARY KEY, content_idea_id INTEGER NOT NULL REFERENCES content_ideas(id), script TEXT NOT NULL, caption TEXT NOT NULL,
  overlay_json TEXT NOT NULL, claims_json TEXT NOT NULL, monetized INTEGER NOT NULL DEFAULT 0, disclosure_required INTEGER NOT NULL DEFAULT 0,
  video_uri TEXT, score REAL, score_dimensions_json TEXT, slop_flags_json TEXT, status TEXT NOT NULL DEFAULT 'GENERATED', rejection_reason TEXT,
  approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS compliance_checks (
  id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES creative_candidates(id), check_type TEXT NOT NULL, passed INTEGER NOT NULL,
  reasons_json TEXT NOT NULL, evidence_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publishing_jobs (
  id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES creative_candidates(id), scheduled_for TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0, idempotency_key TEXT NOT NULL UNIQUE, skip_reason TEXT, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS published_posts (
  id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES creative_candidates(id), platform TEXT NOT NULL, platform_post_id TEXT NOT NULL UNIQUE,
  published_at TEXT NOT NULL, product_id INTEGER NOT NULL REFERENCES products(id), hook TEXT NOT NULL, angle TEXT NOT NULL, format TEXT NOT NULL,
  cta TEXT NOT NULL, length_seconds REAL, publish_time TEXT NOT NULL, hashtags_json TEXT NOT NULL, sound_json TEXT, prompt_summary TEXT,
  candidate_score REAL, experiment_tag TEXT NOT NULL, affiliate_program_id INTEGER REFERENCES affiliate_programs(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS performance_snapshots (
  id INTEGER PRIMARY KEY, published_post_id INTEGER NOT NULL REFERENCES published_posts(id), window TEXT NOT NULL,
  observed_at TEXT NOT NULL, metrics_json TEXT NOT NULL, unavailable_json TEXT NOT NULL, source TEXT NOT NULL,
  UNIQUE(published_post_id, window)
);
CREATE TABLE IF NOT EXISTS agent_findings (
  id INTEGER PRIMARY KEY, finding TEXT NOT NULL, confidence REAL NOT NULL, sample_size INTEGER NOT NULL, date_start TEXT NOT NULL, date_end TEXT NOT NULL,
  observed_lift REAL, evidence_json TEXT NOT NULL, disposition TEXT NOT NULL DEFAULT 'PENDING' CHECK(disposition IN ('PENDING','ACCEPT','QUESTION','IGNORE')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_activity (
  id INTEGER PRIMARY KEY, agent TEXT NOT NULL CHECK(agent IN ('VANTAGE','SCOUT','SYSTEM')), action TEXT NOT NULL, summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON publishing_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_snapshots_post ON performance_snapshots(published_post_id, observed_at);
`;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const current = db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
  if (!current) {
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(migration); db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString()); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return db;
}

export const now = () => new Date().toISOString();
export const json = (value: unknown) => JSON.stringify(value);
export function setting<T>(db: DatabaseSync, key: string, fallback: T): T {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as { value_json: string } | undefined;
  return row ? JSON.parse(row.value_json) as T : fallback;
}
export function setSetting(db: DatabaseSync, key: string, value: unknown): void {
  db.prepare(`INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(key, json(value), now());
}
export function activity(db: DatabaseSync, agent: 'VANTAGE'|'SCOUT'|'SYSTEM', action: string, summary: string, evidence: unknown = {}): void {
  db.prepare('INSERT INTO agent_activity(agent,action,summary,evidence_json,created_at) VALUES(?,?,?,?,?)').run(agent, action, summary, json(evidence), now());
}
