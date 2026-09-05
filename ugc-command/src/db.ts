import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const migration1 = `
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

const migration2 = `
CREATE TABLE service_packages (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  video_count INTEGER NOT NULL CHECK(video_count > 0), primary_hook_count INTEGER NOT NULL CHECK(primary_hook_count > 0),
  duration_min_seconds INTEGER NOT NULL, duration_max_seconds INTEGER NOT NULL, revision_rounds INTEGER NOT NULL DEFAULT 1,
  organic_usage_included INTEGER NOT NULL DEFAULT 1, paid_ad_usage_included INTEGER NOT NULL DEFAULT 0,
  raw_footage_included INTEGER NOT NULL DEFAULT 0, perpetual_usage_included INTEGER NOT NULL DEFAULT 0,
  exclusivity_included INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, description TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE package_addons (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, price_cents INTEGER CHECK(price_cents IS NULL OR price_cents >= 0),
  pricing_unit TEXT NOT NULL, requires_human_quote INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  terms_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE leads (
  id INTEGER PRIMARY KEY, company TEXT NOT NULL, normalized_company TEXT NOT NULL, website TEXT NOT NULL DEFAULT '', normalized_website TEXT NOT NULL DEFAULT '',
  contact_name TEXT, contact_role TEXT, verified_contact TEXT, contact_verified_at TEXT, product_category TEXT NOT NULL,
  lead_source TEXT NOT NULL, fit_reason TEXT NOT NULL, proposed_concept TEXT, personalization_notes TEXT,
  estimated_deal_cents INTEGER NOT NULL DEFAULT 0 CHECK(estimated_deal_cents >= 0), last_contact_at TEXT, next_action TEXT,
  next_action_at TEXT, stage TEXT NOT NULL CHECK(stage IN ('DISCOVERED','QUALIFIED','PITCH_DRAFTED','AWAITING_APPROVAL','PITCH_SENT','FOLLOW_UP_DUE','REPLIED','DISCOVERY','PROPOSAL_SENT','NEGOTIATION','WON','LOST','NURTURE')),
  assigned_agent TEXT NOT NULL DEFAULT 'SCOUT', human_owner TEXT NOT NULL DEFAULT 'CHRIS', loss_reason TEXT, tags_json TEXT NOT NULL DEFAULT '[]',
  qualification_score REAL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(normalized_company, normalized_website)
);
CREATE TABLE approvals (
  id INTEGER PRIMARY KEY, approval_type TEXT NOT NULL CHECK(approval_type IN ('PROSPECT_OUTREACH','FOLLOW_UP_MESSAGE','PRICING_DISCOUNT','CONTRACT_TERMS','PRODUCT_CLAIM','CREATIVE_BRIEF','FINAL_SCRIPT','CLIENT_DRAFT','FINAL_DELIVERY','PUBLISHING','AFFILIATE_LINK','COMPLIANCE_EXCEPTION','PAYMENT_OVERRIDE')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED','EXPIRED')),
  subject_type TEXT NOT NULL, subject_id INTEGER NOT NULL, action_summary TEXT NOT NULL, recommendation TEXT NOT NULL,
  evidence_json TEXT NOT NULL, risks_json TEXT NOT NULL, requesting_agent TEXT NOT NULL, requested_at TEXT NOT NULL,
  expires_at TEXT, decided_at TEXT, decided_by TEXT, decision_note TEXT, payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE communications (
  id INTEGER PRIMARY KEY, lead_id INTEGER NOT NULL REFERENCES leads(id), direction TEXT NOT NULL CHECK(direction IN ('OUTBOUND','INBOUND')),
  communication_type TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('DRAFT','APPROVED','SENT','RECEIVED','FAILED')),
  approval_id INTEGER REFERENCES approvals(id), external_id TEXT, idempotency_key TEXT UNIQUE, occurred_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE projects (
  id INTEGER PRIMARY KEY, business_type TEXT NOT NULL CHECK(business_type IN ('CLIENT_UGC','AFFILIATE','PORTFOLIO','EXPERIMENT')),
  lead_id INTEGER REFERENCES leads(id), client_name TEXT, title TEXT NOT NULL, product_id INTEGER REFERENCES products(id),
  service_package_id INTEGER REFERENCES service_packages(id), package_snapshot_json TEXT, goal_json TEXT NOT NULL DEFAULT '{}',
  quoted_revenue_cents INTEGER NOT NULL DEFAULT 0, actual_revenue_cents INTEGER NOT NULL DEFAULT 0, expense_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'INTAKE', assigned_agent TEXT NOT NULL DEFAULT 'VANTAGE', human_owner TEXT NOT NULL DEFAULT 'CHRIS',
  deadline TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE project_addons (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, addon_id INTEGER NOT NULL REFERENCES package_addons(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0), price_cents INTEGER NOT NULL CHECK(price_cents >= 0), terms_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(project_id, addon_id)
);
CREATE TABLE client_intakes (
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE, client_brand TEXT, product_information TEXT,
  target_customer TEXT, customer_pain_point TEXT, primary_benefit TEXT, approved_claims_json TEXT NOT NULL DEFAULT '[]',
  prohibited_claims_json TEXT NOT NULL DEFAULT '[]', required_talking_points_json TEXT NOT NULL DEFAULT '[]', required_visuals_json TEXT NOT NULL DEFAULT '[]',
  preferred_examples_json TEXT NOT NULL DEFAULT '[]', brand_voice TEXT, cta TEXT, duration_seconds INTEGER, aspect_ratio TEXT,
  usage_type TEXT, requested_usage_term TEXT, raw_footage_requested INTEGER NOT NULL DEFAULT 0, exclusivity_requested INTEGER NOT NULL DEFAULT 0,
  deadline TEXT, shipping_status TEXT, revision_contact TEXT, final_approver TEXT, portfolio_permission TEXT NOT NULL DEFAULT 'UNKNOWN',
  ai_production_policy TEXT, additional_instructions TEXT, contradictions_json TEXT NOT NULL DEFAULT '[]', completion_status TEXT NOT NULL DEFAULT 'INCOMPLETE',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE agreements (
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE, deliverables_json TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), deposit_cents INTEGER NOT NULL DEFAULT 0, remaining_cents INTEGER NOT NULL DEFAULT 0,
  payment_schedule TEXT, revision_rounds INTEGER NOT NULL, turnaround_days INTEGER, organic_usage INTEGER NOT NULL DEFAULT 1,
  paid_ad_usage INTEGER NOT NULL DEFAULT 0, usage_start TEXT, usage_expires TEXT, perpetual_usage INTEGER NOT NULL DEFAULT 0,
  raw_footage_ownership INTEGER NOT NULL DEFAULT 0, category_exclusivity INTEGER NOT NULL DEFAULT 0, competitor_exclusivity INTEGER NOT NULL DEFAULT 0,
  cancellation_terms TEXT, rescheduling_terms TEXT, portfolio_permission TEXT NOT NULL DEFAULT 'UNKNOWN', ai_production_terms TEXT,
  client_approved_at TEXT, creator_approved_at TEXT, signature_status TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id), invoice_number TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  kind TEXT NOT NULL CHECK(kind IN ('DEPOSIT','BALANCE','FULL','REFUND')), status TEXT NOT NULL CHECK(status IN ('DRAFT','SENT','PARTIALLY_PAID','PAID','VOID','OVERDUE','REFUNDED')),
  due_at TEXT, provider TEXT NOT NULL DEFAULT 'MANUAL', external_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE payments (
  id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id), amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  status TEXT NOT NULL CHECK(status IN ('PENDING','CONFIRMED','FAILED','REFUNDED')), provider TEXT NOT NULL DEFAULT 'MANUAL',
  external_id TEXT, idempotency_key TEXT NOT NULL UNIQUE, confirmed_at TEXT, recorded_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE production_items (
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id), title TEXT NOT NULL, format TEXT NOT NULL, hook TEXT, cta TEXT,
  assigned_agent TEXT NOT NULL DEFAULT 'VANTAGE', deadline TEXT, stage TEXT NOT NULL CHECK(stage IN ('IDEA','RESEARCH','BRIEF','SCRIPT','ASSETS_NEEDED','READY_TO_GENERATE','GENERATING','INTERNAL_QA','CLIENT_REVIEW','REVISION','APPROVED','SCHEDULED','PUBLISHED','DELIVERED','ARCHIVED','BLOCKED')),
  required_approvals_json TEXT NOT NULL DEFAULT '[]', disclosure_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED', claim_status TEXT NOT NULL DEFAULT 'PENDING',
  usage_rights_json TEXT NOT NULL DEFAULT '{}', experiment_id INTEGER REFERENCES experiments(id), revenue_cents INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE deliverable_versions (
  id INTEGER PRIMARY KEY, production_item_id INTEGER NOT NULL REFERENCES production_items(id), version_number INTEGER NOT NULL,
  file_uri TEXT NOT NULL, watermarked INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('DRAFT','INTERNAL_QA','CLIENT_REVIEW','APPROVED','DELIVERED','ARCHIVED')),
  notes TEXT, created_at TEXT NOT NULL, UNIQUE(production_item_id, version_number)
);
CREATE TABLE revisions (
  id INTEGER PRIMARY KEY, production_item_id INTEGER NOT NULL REFERENCES production_items(id), version_id INTEGER REFERENCES deliverable_versions(id),
  requested_by TEXT NOT NULL, request_text TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('REQUESTED','IN_PROGRESS','COMPLETED','DECLINED')),
  created_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id), version_id INTEGER NOT NULL REFERENCES deliverable_versions(id),
  delivery_type TEXT NOT NULL CHECK(delivery_type IN ('WATERMARKED_DRAFT','FINAL_UNWATERMARKED')), status TEXT NOT NULL CHECK(status IN ('READY','DELIVERED','BLOCKED')),
  delivered_at TEXT, delivered_by TEXT, download_count INTEGER NOT NULL DEFAULT 0, last_download_at TEXT, approval_id INTEGER REFERENCES approvals(id),
  payment_override_approval_id INTEGER REFERENCES approvals(id), idempotency_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
);
CREATE TABLE portfolio_items (
  id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id), title TEXT NOT NULL, product_brand TEXT, category TEXT NOT NULL,
  ugc_format TEXT NOT NULL CHECK(ugc_format IN ('PRODUCT_DEMONSTRATION','PROBLEM_SOLUTION','TESTIMONIAL','UNBOXING','SOFTWARE_WEBSITE_DEMO')),
  video_uri TEXT, thumbnail_uri TEXT, description TEXT NOT NULL, skills_json TEXT NOT NULL DEFAULT '[]',
  permission_status TEXT NOT NULL CHECK(permission_status IN ('UNKNOWN','REQUESTED','GRANTED','DENIED','SELF_INITIATED')),
  featured INTEGER NOT NULL DEFAULT 0, visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN ('PUBLIC','PRIVATE')),
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE financial_entries (
  id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id), business_type TEXT NOT NULL CHECK(business_type IN ('CLIENT_UGC','AFFILIATE','PORTFOLIO','EXPERIMENT')),
  entry_type TEXT NOT NULL CHECK(entry_type IN ('REVENUE','EXPENSE','REFUND','COMMISSION','INVOICE')), amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  status TEXT NOT NULL CHECK(status IN ('ESTIMATED','PENDING','CONFIRMED')), occurred_at TEXT NOT NULL, description TEXT NOT NULL, source_type TEXT, source_id INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, event_type TEXT NOT NULL, subject_type TEXT NOT NULL,
  subject_id INTEGER, summary TEXT NOT NULL, detail_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE external_actions (
  id INTEGER PRIMARY KEY, action_type TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE, approval_id INTEGER REFERENCES approvals(id), status TEXT NOT NULL CHECK(status IN ('PREPARED','COMPLETED','FAILED','UNKNOWN','BLOCKED')),
  external_id TEXT, result_summary TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_leads_stage ON leads(stage, next_action_at);
CREATE INDEX idx_approvals_status ON approvals(status, requested_at);
CREATE INDEX idx_projects_type_status ON projects(business_type, status);
CREATE INDEX idx_production_stage ON production_items(stage, deadline);
CREATE INDEX idx_financial_type_status ON financial_entries(business_type, status);
CREATE INDEX idx_audit_created ON audit_events(created_at);
`;

const migration3 = `
ALTER TABLE projects ADD COLUMN production_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN testimonial_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED' CHECK(testimonial_status IN ('NOT_REQUESTED','REQUESTED','RECEIVED','DECLINED'));
ALTER TABLE projects ADD COLUMN repeat_order_status TEXT NOT NULL DEFAULT 'NOT_PROMPTED' CHECK(repeat_order_status IN ('NOT_PROMPTED','PROMPTED','ORDERED','DECLINED'));
ALTER TABLE deliverable_versions ADD COLUMN sha256 TEXT;
ALTER TABLE deliveries ADD COLUMN receipt_code TEXT;
CREATE TABLE project_checks (
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_item_id INTEGER REFERENCES production_items(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK(check_type IN ('CLAIM','DISCLOSURE','HOOK','CTA','END_CARD','CREATIVE_VARIETY','PLATFORM_POLICY','QUALITY')),
  passed INTEGER NOT NULL, reasons_json TEXT NOT NULL DEFAULT '[]', evidence_json TEXT NOT NULL DEFAULT '{}',
  checked_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE download_events (
  id INTEGER PRIMARY KEY, delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  downloaded_at TEXT NOT NULL, recorded_by TEXT NOT NULL
);
CREATE TABLE client_followups (
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  followup_type TEXT NOT NULL CHECK(followup_type IN ('TESTIMONIAL','REPEAT_ORDER')),
  status TEXT NOT NULL CHECK(status IN ('DRAFT','APPROVED','SENT','RECEIVED','DECLINED')),
  message TEXT NOT NULL, approval_id INTEGER REFERENCES approvals(id), sent_at TEXT,
  idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_project_checks_project ON project_checks(project_id, check_type);
CREATE INDEX idx_followups_project ON client_followups(project_id, followup_type);
CREATE UNIQUE INDEX idx_deliveries_receipt_code ON deliveries(receipt_code) WHERE receipt_code IS NOT NULL;
`;

const migrations = [{ version: 1, sql: migration1 }, { version: 2, sql: migration2 }, { version: 3, sql: migration3 }];

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const current = db.prepare('SELECT COALESCE(MAX(version), 0) version FROM schema_migrations').get() as { version: number };
  for (const item of migrations.filter(item => item.version > current.version)) {
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(item.sql); db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(item.version, new Date().toISOString()); db.exec('COMMIT'); }
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
