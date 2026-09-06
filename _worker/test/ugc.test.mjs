import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  handleUgc,
  prepareVantagePacket,
  scopeConflicts,
  validateBrief,
  validateInquiry,
} from "../src/ugc.js";

const origin = "https://echov4ult.com";
const envBase = {
  UGC_CSRF_SECRET: "c".repeat(40),
  UGC_ABUSE_SECRET: "a".repeat(40),
  UGC_SYNC_SECRET: "s".repeat(40),
};

function validInquiry(overrides = {}) {
  return {
    name: "Ada Client",
    email: "ada@example.com",
    company: "Example Brand",
    companyUrl: "https://example.com",
    productName: "Example App",
    productUrl: "https://example.com/app",
    contentTypes: ["tutorial"],
    videoCount: "2–3",
    completionWindow: "Within 30 days",
    budget: "1000-2000",
    usageLocations: ["organic-tiktok"],
    usageKind: "organic",
    objective: "Explain the product clearly.",
    consent: true,
    ...overrides,
  };
}

function validBrief(overrides = {}) {
  return {
    legalCompanyName: "Example LLC",
    brandName: "Example",
    website: "https://example.com",
    primaryContact: "Ada",
    contactEmail: "ada@example.com",
    finalApprover: "Grace",
    approverEmail: "grace@example.com",
    productName: "Example App",
    productUrl: "https://example.com/app",
    productCategory: "Software",
    productType: "software",
    softwareAccess:
      "A test account will be supplied through the approved channel.",
    productDescription: "A useful app.",
    targetCustomer: "Small teams",
    mainProblem: "Slow workflows",
    primaryBenefit: "Faster review",
    campaignObjective: "Product education",
    desiredAction: "Start a trial",
    requestedFormat: "Tutorial",
    tone: "Educational",
    productionMethod: "HYBRID_AI_ASSISTED",
    videoCount: "2",
    videoLength: "30 seconds",
    aspectRatio: "9:16",
    resolution: "1080 × 1920",
    fileFormat: "MP4",
    requestedDeliveryDate: "2026-10-01",
    usageKind: "organic",
    usageDuration: "90 days",
    territory: "United States",
    claims: [
      { claim: "Cuts review time", source: "https://example.com/evidence" },
    ],
    assetLinks: ["https://drive.example.com/assets"],
    assetRightsConfirmed: true,
    finalConsent: true,
    ...overrides,
  };
}

class FakeDb {
  constructor(projectRow = null) {
    this.projectRow = projectRow;
    this.attempts = 0;
    this.inquiries = new Map();
    this.batches = [];
    this.runs = [];
    this.prepared = [];
    this.inquiryRow = null;
    this.linkedCount = 0;
    this.runChanges = 1;
    this.batchFirstChanges = 1;
  }
  prepare(sql) {
    const db = this;
    const statement = {
      sql,
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async first() {
        if (sql.includes("FROM ugc_project_tokens t JOIN"))
          return db.projectRow;
        if (
          sql.includes("SELECT id FROM ugc_project_tokens WHERE creation_key")
        )
          return db.projectCreation ? { id: db.projectCreation } : null;
        if (sql.includes("SELECT COUNT(*) count FROM ugc_project_tokens"))
          return { count: db.linkedCount };
        if (sql.includes("SELECT attempt_count"))
          return { attempt_count: db.attempts };
        if (sql.includes("FROM ugc_inquiries WHERE id=?")) return db.inquiryRow;
        if (sql.includes("SELECT id FROM ugc_inquiries")) {
          const row = db.inquiries.get(this.values[0]);
          return row ? { id: row } : null;
        }
        return null;
      },
      async run() {
        if (sql.includes("INSERT INTO ugc_rate_windows")) db.attempts += 1;
        db.runs.push({ sql, values: this.values });
        return { meta: { changes: db.runChanges } };
      },
      async all() {
        return { results: [] };
      },
    };
    this.prepared.push(statement);
    return statement;
  }
  async batch(statements) {
    this.batches.push(statements);
    if (statements.some((s) => s.sql?.includes("INSERT INTO ugc_rate_windows")))
      this.attempts += 1;
    const inquiry = statements.find((s) =>
      s.sql?.includes("INSERT INTO ugc_inquiries"),
    );
    if (inquiry) this.inquiries.set(inquiry.values[1], inquiry.values[0]);
    return statements.map((_, index) => ({ success: true, meta: { changes: index === 0 ? this.batchFirstChanges : 1 } }));
  }
}

function adminRequest(url, method = "GET", body) {
  return new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${envBase.UGC_SYNC_SECRET}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function projectRequest(url, method, security, body, projectToken) {
  return new Request(url, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-UGC-CSRF": security.token,
      "X-UGC-Project-Token": projectToken,
      Cookie: security.cookie,
    },
    body: JSON.stringify(body),
  });
}

async function csrf(env) {
  const response = await handleUgc(
    new Request(`${origin}/api/ugc/csrf`, { headers: { Origin: origin } }),
    env,
    new URL(`${origin}/api/ugc/csrf`),
  );
  const body = await response.json();
  return {
    token: body.token,
    cookie: response.headers.get("set-cookie").split(";")[0],
  };
}

async function postInquiry(env, security, body, key = "abcdefghijklmnop") {
  const url = new URL(`${origin}/api/ugc/inquiries`);
  return handleUgc(
    new Request(url, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-UGC-CSRF": security.token,
        Cookie: security.cookie,
        "Idempotency-Key": key,
        "CF-Connecting-IP": "192.0.2.1",
      },
      body: JSON.stringify(body),
    }),
    env,
    url,
  );
}

test("public inquiry validates required fields, email, URL, choices, and consent", () => {
  assert.equal(validateInquiry(validInquiry()).ok, true);
  const invalid = validateInquiry(
    validInquiry({
      email: "bad",
      productUrl: "javascript:alert(1)",
      contentTypes: [],
      consent: false,
    }),
  );
  assert.equal(invalid.ok, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    "consent",
    "contentTypes",
    "email",
    "productUrl",
  ]);
});

test("final brief enforces conditional claims, software access, raw footage, exclusivity, and asset rights", () => {
  assert.equal(validateBrief(validBrief(), true).ok, true);
  const invalid = validateBrief(
    validBrief({
      claims: [{ claim: "Unsupported", source: "" }],
      softwareAccess: "",
      rawFootageRequested: true,
      rawFootageDetails: "",
      exclusivityRequested: true,
      exclusivityCategory: "",
      assetRightsConfirmed: false,
    }),
    true,
  );
  assert.equal(invalid.ok, false);
  for (const field of [
    "claims",
    "softwareAccess",
    "rawFootageDetails",
    "exclusivity",
    "assetRightsConfirmed",
  ])
    assert.ok(invalid.errors[field]);
});

test("proposal conflicts are explicit and require human approval", () => {
  const conflicts = scopeConflicts(
    { videoCount: 1, usageKind: "organic" },
    { videoCount: 3, usageKind: "paid" },
  );
  assert.equal(conflicts.length, 2);
  assert.ok(conflicts.every((item) => item.requiresApproval));
});

test("VANTAGE packet is production-blocked and leaves claims for human review", () => {
  const packet = prepareVantagePacket(validBrief(), {}, [], []);
  assert.equal(packet.humanApprovalRequest.productionBlocked, true);
  assert.ok(
    packet.humanApprovalRequest.blockers.includes(
      "PAYMENT_STATUS_NOT_VERIFIED",
    ),
  );
  assert.ok(
    packet.humanApprovalRequest.blockers.includes("ASSETS_NOT_RECEIVED"),
  );
  assert.equal(packet.claims[0].approval, "PENDING_HUMAN_REVIEW");
  assert.equal(packet.hookRecommendations.length, 3);
});

test("admin routes reject missing credentials without exposing details", async () => {
  const db = new FakeDb();
  const url = new URL(`${origin}/api/ugc/admin/inquiries`);
  const response = await handleUgc(
    new Request(url),
    { ...envBase, UGC_DB: db },
    url,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("READY_FOR_PRODUCTION is blocked until every clearance is explicitly recorded", async () => {
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    url = new URL(`${origin}/api/ugc/admin/inquiries/UGC-12345678`);
  db.inquiryRow = { id: "UGC-12345678", status: "NEW_INQUIRY", production_clearance_json: "{}" };
  const response = await handleUgc(
    new Request(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${envBase.UGC_SYNC_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "READY_FOR_PRODUCTION",
        productionClearance: { humanApproval: true },
      }),
    }),
    env,
    url,
  );
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /Every production clearance/);
});

test("honeypot succeeds quietly without writing or notifying", async () => {
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    security = await csrf(env);
  const response = await postInquiry(
    env,
    security,
    validInquiry({ botField: "spam" }),
  );
  assert.equal(response.status, 202);
  assert.equal(db.batches.length, 0);
});

test("duplicate inquiry retries return the original record", async () => {
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    security = await csrf(env),
    key = "same_request_key_123";
  const first = await postInquiry(env, security, validInquiry(), key);
  const second = await postInquiry(env, security, validInquiry(), key);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).inquiryId, (await second.json()).inquiryId);
  assert.equal(
    db.batches.filter((batch) => batch.some((entry) => entry.sql?.includes("INSERT INTO ugc_inquiries"))).length,
    1,
  );
});

test("rate limit rejects the ninth accepted attempt in one window", async () => {
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    security = await csrf(env);
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await postInquiry(
          env,
          security,
          validInquiry(),
          `request_key_${i}_abcdef`,
        )
      ).status,
      201,
    );
  assert.equal(
    (await postInquiry(env, security, validInquiry(), "request_key_9_abcdef"))
      .status,
    429,
  );
});

test("oversized requests and unsupported asset-link schemes are rejected", async () => {
  const invalid = validateBrief(
    validBrief({ assetLinks: ["file:///private/logo.png"] }),
    true,
  );
  assert.ok(invalid.errors.assetLinks);
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    security = await csrf(env),
    url = new URL(`${origin}/api/ugc/inquiries`);
  const response = await handleUgc(
    new Request(url, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "Content-Length": "96001",
        "X-UGC-CSRF": security.token,
        Cookie: security.cookie,
      },
      body: "{}",
    }),
    env,
    url,
  );
  assert.equal(response.status, 413);
});

test("private project links store only a hash and duplicate creation is rejected", async () => {
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    url = new URL(`${origin}/api/ugc/admin/projects`),
    key = "project_create_key_123";
  const request = () =>
    new Request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envBase.UGC_SYNC_SECRET}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ projectRef: "PROJECT-42" }),
    });
  const first = await handleUgc(request(), env, url),
    result = await first.json();
  assert.equal(first.status, 201);
  const rawToken = new URL(result.url).hash.slice(1),
    insert = db.batches[0].find((statement) =>
      statement.sql.includes("INSERT INTO ugc_project_tokens"),
    );
  assert.ok(rawToken.length >= 43);
  assert.notEqual(insert.values[4], rawToken);
  assert.ok(!insert.values.includes(rawToken));
  db.projectCreation = result.projectAccessId;
  const second = await handleUgc(request(), env, url);
  assert.equal(second.status, 409);
});

test("expired and revoked project links return the same safe error", async () => {
  for (const projectRow of [
    {
      id: "p1",
      status: "ACTIVE",
      expires_at: "2020-01-01",
      revoked_at: null,
      brief_status: "DRAFT",
      draft_json: "{}",
    },
    {
      id: "p2",
      status: "REVOKED",
      expires_at: "2099-01-01",
      revoked_at: "2026-01-01",
      brief_status: "DRAFT",
      draft_json: "{}",
    },
  ]) {
    const db = new FakeDb(projectRow),
      token = "x".repeat(43),
      url = new URL(`${origin}/api/ugc/projects/current`);
    const response = await handleUgc(
      new Request(url, { headers: { "X-UGC-Project-Token": token } }),
      { ...envBase, UGC_DB: db },
      url,
    );
    assert.equal(response.status, 404);
    assert.match((await response.json()).error, /invalid, expired, or revoked/);
  }
});

test("notification intents remain PREVIEW and integration events remain PENDING", async () => {
  const migration = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../migrations/0001_ugc_intake.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.match(migration, /ugc_notification_outbox[\s\S]*DEFAULT 'PREVIEW'/);
  assert.match(migration, /ugc_integration_outbox[\s\S]*DEFAULT 'PENDING'/);
  assert.doesNotMatch(migration, /password|secret_value|raw_token/i);
});

test("dedicated UGC secrets are required and cannot reuse one value", async () => {
  for (const env of [
    { ...envBase, UGC_CSRF_SECRET: undefined },
    { ...envBase, UGC_ABUSE_SECRET: undefined },
    { ...envBase, UGC_ABUSE_SECRET: envBase.UGC_CSRF_SECRET },
  ]) {
    const url = new URL(`${origin}/api/ugc/csrf`);
    const response = await handleUgc(
      new Request(url, { headers: { Origin: origin } }),
      { ...env, UGC_DB: new FakeDb() },
      url,
    );
    assert.equal(response.status, 503);
  }
});

test("D1 migration executes in Wrangler's production-compatible local database", () => {
  const persistence = mkdtempSync(join(tmpdir(), "ugc-d1-"));
  try {
    const workerRoot = fileURLToPath(new URL("..", import.meta.url));
    const wrangler = fileURLToPath(
      new URL("../node_modules/.bin/wrangler", import.meta.url),
    );
    const migration = fileURLToPath(
      new URL("../migrations/0001_ugc_intake.sql", import.meta.url),
    );
    const config = join(persistence, "wrangler.toml");
    writeFileSync(
      config,
      'name="ugc-d1-test"\nmain="src/index.js"\ncompatibility_date="2026-08-25"\n[[d1_databases]]\nbinding="UGC_DB"\ndatabase_name="ugc-d1-test"\ndatabase_id="00000000-0000-0000-0000-000000000000"\n',
    );
    const run = (...args) =>
      spawnSync(wrangler, args, {
        cwd: workerRoot,
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1" },
      });
    const applied = run(
      "d1",
      "execute",
      "UGC_DB",
      "--config",
      config,
      "--local",
      "--persist-to",
      persistence,
      "--file",
      migration,
      "--yes",
    );
    assert.equal(applied.status, 0, applied.stderr || applied.stdout);
    const checked = run(
      "d1",
      "execute",
      "UGC_DB",
      "--config",
      config,
      "--local",
      "--persist-to",
      persistence,
      "--command",
      "SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name LIKE 'ugc_%';",
      "--json",
    );
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
    const rows = JSON.parse(checked.stdout);
    assert.ok(rows[0].results[0].count >= 8);
  } finally {
    rmSync(persistence, { recursive: true, force: true });
  }
});

test("router safely handles missing storage, CORS preflight, and unknown routes", async () => {
  const unknown = new URL(`${origin}/api/ugc/unknown`);
  const missing = await handleUgc(new Request(unknown), {}, unknown);
  assert.equal(missing.status, 503);

  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    preflight = await handleUgc(
      new Request(unknown, { method: "OPTIONS", headers: { Origin: origin } }),
      env,
      unknown,
    );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);

  const notFound = await handleUgc(new Request(unknown), env, unknown);
  assert.equal(notFound.status, 404);
});

test("public write gate rejects bad origin, encoding, and CSRF states", async () => {
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    url = new URL(`${origin}/api/ugc/inquiries`);

  const disallowed = await handleUgc(
    new Request(url, {
      method: "POST",
      headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" },
      body: "{}",
    }),
    env,
    url,
  );
  assert.equal(disallowed.status, 403);

  const wrongType = await handleUgc(
    new Request(url, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "text/plain" },
      body: "{}",
    }),
    env,
    url,
  );
  assert.equal(wrongType.status, 415);

  const missing = await handleUgc(
    new Request(url, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: "{}",
    }),
    env,
    url,
  );
  assert.equal(missing.status, 403);

  const expired = "1.expired.signature";
  const stale = await handleUgc(
    new Request(url, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-UGC-CSRF": expired,
        Cookie: `ugc_csrf=${expired}`,
      },
      body: "{}",
    }),
    env,
    url,
  );
  assert.equal(stale.status, 403);
});

test("active project links load, save, and complete into one conflict-safe VANTAGE packet", async () => {
  const token = "p".repeat(43),
    projectRow = {
      id: "project-1",
      inquiry_id: "UGC-12345678",
      project_ref: "PROJECT-42",
      status: "ACTIVE",
      revoked_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      brief_status: "DRAFT",
      revision: 2,
      draft_json: JSON.stringify({ brandName: "Saved Brand" }),
      proposal_snapshot_json: JSON.stringify({ videoCount: "1", usageKind: "paid" }),
    },
    db = new FakeDb(projectRow),
    env = { ...envBase, UGC_DB: db },
    baseUrl = new URL(`${origin}/api/ugc/projects/current`);

  const opened = await handleUgc(
    new Request(baseUrl, { headers: { "X-UGC-Project-Token": token } }),
    env,
    baseUrl,
  );
  assert.equal(opened.status, 200);
  assert.deepEqual((await opened.json()).draft, { brandName: "Saved Brand" });

  const security = await csrf(env);
  const saved = await handleUgc(
    projectRequest(baseUrl, "PATCH", security, { brandName: "New draft", expectedRevision: 2 }, token),
    env,
    baseUrl,
  );
  assert.equal(saved.status, 200);
  assert.ok(db.runs.some((entry) => entry.sql.includes("revision=revision+1")));

  const completeUrl = new URL(`${origin}/api/ugc/projects/current/complete`),
    completed = await handleUgc(
      projectRequest(completeUrl, "POST", security, validBrief({ expectedRevision: 2 }), token),
      env,
      completeUrl,
    ),
    result = await completed.json();
  assert.equal(completed.status, 201);
  assert.equal(result.conflictCount, 2);

  const briefUpdate = db.batches
    .flat()
    .find((statement) => statement.sql?.includes("vantage_packet_json"));
  const packet = JSON.parse(briefUpdate.values[4]);
  assert.equal(
    packet.humanApprovalRequest.blockers.filter(
      (blocker) => blocker === "SCOPE_CONFLICTS",
    ).length,
    1,
  );
  assert.equal(packet.humanApprovalRequest.productionBlocked, true);
});

test("submitted project briefs reject draft writes and make completion idempotent", async () => {
  const token = "s".repeat(43),
    projectRow = {
      id: "project-submitted",
      project_ref: "PROJECT-99",
      status: "ACTIVE",
      revoked_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      brief_status: "SUBMITTED",
      revision: 3,
      draft_json: "{}",
      proposal_snapshot_json: "{}",
    },
    db = new FakeDb(projectRow),
    env = { ...envBase, UGC_DB: db },
    security = await csrf(env),
    baseUrl = new URL(`${origin}/api/ugc/projects/current`);

  const save = await handleUgc(
    projectRequest(baseUrl, "PATCH", security, {}, token),
    env,
    baseUrl,
  );
  assert.equal(save.status, 409);

  const completeUrl = new URL(`${origin}/api/ugc/projects/current/complete`),
    complete = await handleUgc(
      projectRequest(completeUrl, "POST", security, {}, token),
      env,
      completeUrl,
    );
  assert.equal(complete.status, 200);
  assert.equal((await complete.json()).redirect, "/ugc/project/complete/");
});

test("stale project brief revisions are rejected without overwriting newer work", async () => {
  const token = "r".repeat(43), projectRow = { id:"project-race",project_ref:"PROJECT-RACE",status:"ACTIVE",revoked_at:null,expires_at:"2099-01-01T00:00:00.000Z",brief_status:"DRAFT",revision:5,draft_json:"{}",proposal_snapshot_json:"{}" }, db = new FakeDb(projectRow), env = { ...envBase, UGC_DB: db }, security = await csrf(env), baseUrl = new URL(`${origin}/api/ugc/projects/current`);
  db.runChanges = 0;
  const save = await handleUgc(projectRequest(baseUrl,"PATCH",security,{brandName:"Stale",expectedRevision:4},token),env,baseUrl);
  assert.equal(save.status,409);
  db.runChanges = 1; db.batchFirstChanges = 0;
  const completeUrl = new URL(`${origin}/api/ugc/projects/current/complete`), complete = await handleUgc(projectRequest(completeUrl,"POST",security,validBrief({expectedRevision:4}),token),env,completeUrl);
  assert.equal(complete.status,409);
});

test("authorized admin can list, inspect, update, delete, drain queues, and revoke access", async () => {
  const db = new FakeDb(),
    env = { ...envBase, UGC_DB: db },
    id = "UGC-ADMIN-1";
  db.inquiryRow = { id, status: "NEW_INQUIRY", company: "Example Brand" };
  db.inquiries.set(id, id);

  const listUrl = new URL(
    `${origin}/api/ugc/admin/inquiries?status=NEW_INQUIRY&q=Example&owner=VANTAGE`,
  );
  assert.equal(
    (await handleUgc(adminRequest(listUrl), env, listUrl)).status,
    200,
  );
  const listStatement = db.prepared.find((statement) =>
    statement.sql.includes("ORDER BY created_at DESC LIMIT 100"),
  );
  assert.match(listStatement.sql, /status=\?/);
  assert.deepEqual(listStatement.values, [
    "NEW_INQUIRY",
    "%Example%",
    "%Example%",
    "%Example%",
    "%Example%",
    "VANTAGE",
  ]);

  const itemUrl = new URL(`${origin}/api/ugc/admin/inquiries/${id}`),
    inspected = await handleUgc(adminRequest(itemUrl), env, itemUrl);
  assert.equal(inspected.status, 200);
  assert.equal((await inspected.json()).inquiry.id, id);

  const clearances = Object.fromEntries(
      [
        "payment",
        "information",
        "claims",
        "usage",
        "assets",
        "productionMethod",
        "deadline",
        "compliance",
        "humanApproval",
      ].map((key) => [key, true]),
    ),
    updated = await handleUgc(
      adminRequest(itemUrl, "PATCH", {
        status: "READY_FOR_PRODUCTION",
        owner: "VANTAGE",
        qualification: { fit: "high" },
        approvalDecision: { status: "APPROVED" },
        productionClearance: clearances,
      }),
      env,
      itemUrl,
    );
  assert.equal(updated.status, 200);

  db.inquiryRow = { id, status: "READY_FOR_PRODUCTION", production_clearance_json: JSON.stringify(clearances) };
  const invalidated = await handleUgc(
    adminRequest(itemUrl, "PATCH", { productionClearance: { ...clearances, payment: false } }),
    env,
    itemUrl,
  );
  assert.equal(invalidated.status, 422);

  const removed = await handleUgc(adminRequest(itemUrl, "DELETE"), env, itemUrl);
  assert.equal(removed.status, 200);

  for (const path of ["outbox", "notifications"]) {
    const url = new URL(`${origin}/api/ugc/admin/${path}`);
    assert.equal((await handleUgc(adminRequest(url), env, url)).status, 200);
  }
  const ackUrl = new URL(`${origin}/api/ugc/admin/outbox/ack`),
    acknowledged = await handleUgc(
      adminRequest(ackUrl, "POST", { ids: ["event-1", "event-2"] }),
      env,
      ackUrl,
    );
  assert.equal(acknowledged.status, 200);
  assert.equal(
    db.batches.flat().filter((entry) => entry.sql.includes("status='ACKNOWLEDGED'")).length,
    2,
  );

  const revokeUrl = new URL(
      `${origin}/api/ugc/admin/projects/project-1/revoke`,
    ),
    revoked = await handleUgc(adminRequest(revokeUrl, "POST", {}), env, revokeUrl);
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).ok, true);

  const briefDb = new FakeDb({
      id: "project-1",
      status: "SUBMITTED",
      conflicts_json: "[]",
    }),
    briefEnv = { ...envBase, UGC_DB: briefDb },
    briefUrl = new URL(`${origin}/api/ugc/admin/projects/project-1/brief`),
    brief = await handleUgc(adminRequest(briefUrl), briefEnv, briefUrl);
  assert.equal(brief.status, 200);
  assert.equal((await brief.json()).productionBlocked, false);
});
