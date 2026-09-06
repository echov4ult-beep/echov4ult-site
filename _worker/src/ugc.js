const enc = new TextEncoder();
const CONTENT_TYPES = new Set([
  "product-demonstration",
  "problem-solution",
  "testimonial-style",
  "unboxing",
  "tutorial",
  "comparison",
  "software-website-demo",
  "paid-ad-creative",
  "monthly-package",
  "recommend",
]);
const BUDGETS = new Set([
  "under-250",
  "250-500",
  "500-1000",
  "1000-2000",
  "2000-plus",
  "not-sure",
]);
const USAGE_KINDS = new Set(["organic", "paid", "both", "not-sure"]);
const PRODUCTION_METHODS = new Set([
  "HUMAN_FILMED",
  "HYBRID_AI_ASSISTED",
  "FULLY_SYNTHETIC",
  "RECOMMEND",
]);
const MAX_BODY = 96_000;

export async function handleUgc(request, env, url) {
  if (!env.UGC_DB)
    return api({ error: "UGC intake is not configured yet." }, 503);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(request, env) });
  if (url.pathname === "/api/ugc/csrf" && request.method === "GET")
    return csrfResponse(request, env);
  if (url.pathname === "/api/ugc/inquiries" && request.method === "POST")
    return createInquiry(request, env);
  if (url.pathname === "/api/ugc/admin/projects" && request.method === "POST")
    return createProjectAccess(request, env);
  if (url.pathname === "/api/ugc/admin/inquiries" && request.method === "GET")
    return listInquiries(request, env, url);
  if (url.pathname === "/api/ugc/admin/outbox" && request.method === "GET")
    return readOutbox(request, env);
  if (url.pathname === "/api/ugc/admin/outbox/ack" && request.method === "POST")
    return acknowledgeOutbox(request, env);
  if (
    url.pathname === "/api/ugc/admin/notifications" &&
    request.method === "GET"
  )
    return readNotifications(request, env);
  const inquiry = url.pathname.match(/^\/api\/ugc\/admin\/inquiries\/([^/]+)$/);
  if (inquiry && request.method === "GET")
    return getInquiry(request, env, inquiry[1]);
  if (inquiry && request.method === "PATCH")
    return updateInquiry(request, env, inquiry[1]);
  if (inquiry && request.method === "DELETE")
    return deleteInquiry(request, env, inquiry[1]);
  const brief = url.pathname.match(
    /^\/api\/ugc\/admin\/projects\/([^/]+)\/brief$/,
  );
  if (brief && request.method === "GET")
    return adminBrief(request, env, brief[1]);
  const revoke = url.pathname.match(
    /^\/api\/ugc\/admin\/projects\/([^/]+)\/revoke$/,
  );
  if (revoke && request.method === "POST")
    return revokeProject(request, env, revoke[1]);
  if (
    url.pathname === "/api/ugc/projects/current/complete" &&
    request.method === "POST"
  )
    return completeBrief(request, env, projectToken(request));
  if (
    url.pathname === "/api/ugc/projects/current" &&
    request.method === "GET"
  )
    return getBrief(request, env, projectToken(request));
  if (
    url.pathname === "/api/ugc/projects/current" &&
    request.method === "PATCH"
  )
    return saveBrief(request, env, projectToken(request));
  return api({ error: "Not found" }, 404);
}

export function validateInquiry(value) {
  const errors = {};
  requiredText(value, errors, [
    "name",
    "company",
    "productName",
    "completionWindow",
    "videoCount",
    "objective",
  ]);
  if (!validEmail(value.email)) errors.email = "Enter a valid work email.";
  if (!validHttpUrl(value.companyUrl))
    errors.companyUrl = "Enter a full company or product URL.";
  if (!validHttpUrl(value.productUrl))
    errors.productUrl = "Enter a full product or website URL.";
  const types = cleanList(value.contentTypes);
  if (!types.length || types.some((x) => !CONTENT_TYPES.has(x)))
    errors.contentTypes = "Choose at least one content type.";
  const locations = cleanList(value.usageLocations);
  if (!locations.length)
    errors.usageLocations = "Choose at least one usage location.";
  if (!BUDGETS.has(String(value.budget || "")))
    errors.budget = "Choose an estimated budget.";
  if (!USAGE_KINDS.has(String(value.usageKind || "")))
    errors.usageKind = "Choose the expected usage type.";
  if (value.consent !== true)
    errors.consent = "Consent is required to submit this inquiry.";
  if (String(value.phone || "").length > 40)
    errors.phone = "Phone number is too long.";
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: {
      name: text(value.name, 120),
      email: String(value.email || "")
        .trim()
        .toLowerCase(),
      company: text(value.company, 160),
      companyUrl: String(value.companyUrl || "").trim(),
      phone: text(value.phone, 40),
      preferredContact: text(value.preferredContact, 30),
      productName: text(value.productName, 240),
      productUrl: String(value.productUrl || "").trim(),
      contentTypes: types,
      videoCount: text(value.videoCount, 40),
      completionWindow: text(value.completionWindow, 80),
      budget: String(value.budget || ""),
      usageLocations: locations,
      usageKind: String(value.usageKind || ""),
      objective: text(value.objective, 2000),
      notes: text(value.notes, 2000),
      marketingConsent: value.marketingConsent === true,
    },
  };
}

export function validateBrief(value, final = false) {
  const errors = {},
    data = structuredClone(value && typeof value === "object" ? value : {});
  if (!final) return { ok: true, errors, data };
  requiredText(data, errors, [
    "legalCompanyName",
    "brandName",
    "website",
    "primaryContact",
    "contactEmail",
    "finalApprover",
    "approverEmail",
    "productName",
    "productUrl",
    "productCategory",
    "productType",
    "productDescription",
    "targetCustomer",
    "mainProblem",
    "primaryBenefit",
    "campaignObjective",
    "desiredAction",
    "requestedFormat",
    "tone",
    "productionMethod",
    "videoCount",
    "videoLength",
    "aspectRatio",
    "resolution",
    "fileFormat",
    "requestedDeliveryDate",
    "usageKind",
    "usageDuration",
    "territory",
  ]);
  if (!validEmail(data.contactEmail))
    errors.contactEmail = "Enter a valid contact email.";
  if (!validEmail(data.approverEmail))
    errors.approverEmail = "Enter a valid approver email.";
  if (!validHttpUrl(data.website)) errors.website = "Enter a full website URL.";
  if (!validHttpUrl(data.productUrl))
    errors.productUrl = "Enter a full product URL.";
  if (!PRODUCTION_METHODS.has(String(data.productionMethod || "")))
    errors.productionMethod = "Choose a production method.";
  if (
    !Array.isArray(data.claims) ||
    !data.claims.length ||
    data.claims.some(
      (claim) => !text(claim?.claim, 500) || !validHttpUrl(claim?.source),
    )
  )
    errors.claims = "Each requested claim needs a supporting source URL.";
  if (
    ["paid", "both"].includes(String(data.usageKind || "")) &&
    !text(data.usageDuration, 80)
  )
    errors.usageDuration = "Paid usage requires a duration.";
  if (
    data.exclusivityRequested &&
    (!text(data.exclusivityCategory, 120) ||
      !text(data.exclusivityDuration, 80))
  )
    errors.exclusivity = "Enter the exclusivity category and duration.";
  if (data.temporaryPromotion && !text(data.promotionExpires, 40))
    errors.promotionExpires = "Enter the promotion expiration date.";
  if (
    data.realProductRequired &&
    !["ship", "assets", "already-available"].includes(data.productAccess)
  )
    errors.productAccess = "Explain how the real product will be provided.";
  if (data.rawFootageRequested && !text(data.rawFootageDetails, 1000))
    errors.rawFootageDetails =
      "Describe the requested raw footage and its use.";
  if (data.productType === "software" && !text(data.softwareAccess, 1000))
    errors.softwareAccess =
      "Explain how EchoVault can access the software or demo.";
  for (const url of cleanList(data.assetLinks))
    if (!validHttpUrl(url))
      errors.assetLinks =
        "Each asset reference must be a full http or https URL.";
  if (data.assetRightsConfirmed !== true)
    errors.assetRightsConfirmed =
      "Confirm that you have rights to supplied assets.";
  if (data.finalConsent !== true)
    errors.finalConsent = "Complete the final acknowledgments.";
  return { ok: Object.keys(errors).length === 0, errors, data };
}

async function createInquiry(request, env) {
  const gate = await publicGate(request, env);
  if (gate) return gate;
  const payload = await readJson(request);
  if (!payload) return api({ error: "Invalid request." }, 400, request, env);
  if (text(payload.botField, 10))
    return api({ ok: true, redirect: "/ugc/thank-you/" }, 202, request, env);
  const checked = validateInquiry(payload);
  if (!checked.ok)
    return api(
      { error: "Check the highlighted fields.", fields: checked.errors },
      422,
      request,
      env,
    );
  const idempotency = request.headers.get("Idempotency-Key");
  if (!validIdempotency(idempotency))
    return api(
      { error: "Submission identifier is missing." },
      400,
      request,
      env,
    );
  const abuseKey = await abuseHash(request, env);
  if (!abuseKey)
    return api(
      { error: "UGC security is not configured." },
      503,
      request,
      env,
    );
  if (!(await consumeRate(env.UGC_DB, abuseKey)))
    return api(
      { error: "Too many attempts. Wait before trying again." },
      429,
      request,
      env,
    );
  const existing = await env.UGC_DB.prepare(
    "SELECT id FROM ugc_inquiries WHERE idempotency_key=?",
  )
    .bind(idempotency)
    .first();
  if (existing)
    return api(
      { ok: true, inquiryId: existing.id, redirect: "/ugc/thank-you/" },
      200,
      request,
      env,
    );
  const id = `UGC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    now = new Date().toISOString(),
    d = checked.data;
  const statements = [
    env.UGC_DB.prepare(
      `INSERT INTO ugc_inquiries(id,idempotency_key,name,email,company,company_url,phone,preferred_contact,product_name,product_url,content_types_json,video_count,completion_window,budget,usage_locations_json,usage_kind,objective,notes,marketing_consent,abuse_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id,
      idempotency,
      d.name,
      d.email,
      d.company,
      d.companyUrl,
      d.phone || null,
      d.preferredContact || null,
      d.productName,
      d.productUrl,
      JSON.stringify(d.contentTypes),
      d.videoCount,
      d.completionWindow,
      d.budget,
      JSON.stringify(d.usageLocations),
      d.usageKind,
      d.objective,
      d.notes || null,
      d.marketingConsent ? 1 : 0,
      abuseKey,
      now,
      now,
    ),
    outbox(env.UGC_DB, "INQUIRY_RECEIVED", id, `inquiry:${id}:received`, {
      inquiryId: id,
      status: "NEW_INQUIRY",
    }),
    notice(env.UGC_DB, "INTERNAL_INQUIRY", `internal:${id}`, id, id, {
      inquiryId: id,
      company: d.company,
    }),
    notice(env.UGC_DB, "INQUIRY_CONFIRMATION", `confirmation:${id}`, id, id, {
      inquiryId: id,
      name: d.name,
    }),
    env.UGC_DB.prepare(
      "INSERT INTO ugc_status_history(id,inquiry_id,status,detail_json,created_at) VALUES(?,?,?,?,?)",
    ).bind(crypto.randomUUID(), id, "NEW_INQUIRY", "{}", now),
    audit(env.UGC_DB, "INQUIRY_CREATED", "INQUIRY", id, {
      status: "NEW_INQUIRY",
    }),
  ];
  await env.UGC_DB.batch(statements);
  return api(
    { ok: true, inquiryId: id, redirect: "/ugc/thank-you/" },
    201,
    request,
    env,
  );
}

async function createProjectAccess(request, env) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const body = await readJson(request);
  if (!body || !text(body.projectRef, 120))
    return api({ error: "Project reference is required." }, 422);
  const creationKey = request.headers.get("Idempotency-Key");
  if (!validIdempotency(creationKey))
    return api({ error: "Submission identifier is missing." }, 400);
  const existing = await env.UGC_DB.prepare(
    "SELECT id FROM ugc_project_tokens WHERE creation_key=?",
  )
    .bind(creationKey)
    .first();
  if (existing)
    return api(
      {
        error:
          "This project-link request was already processed. Revoke it before creating a replacement.",
        projectAccessId: existing.id,
      },
      409,
    );
  const token = randomToken(32),
    hash = await sha256(token),
    id = crypto.randomUUID(),
    now = new Date().toISOString(),
    days = Math.min(30, Math.max(1, Number(body.expiresInDays || 14))),
    expires = new Date(Date.now() + days * 86400000).toISOString();
  await env.UGC_DB.batch([
    env.UGC_DB.prepare(
      `INSERT INTO ugc_project_tokens(id,inquiry_id,project_ref,creation_key,token_hash,expires_at,proposal_snapshot_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id,
      body.inquiryId || null,
      text(body.projectRef, 120),
      creationKey,
      hash,
      expires,
      JSON.stringify(body.proposalSnapshot || {}),
      now,
      now,
    ),
    env.UGC_DB.prepare(
      `INSERT INTO ugc_project_briefs(project_token_id,created_at,updated_at) VALUES(?,?,?)`,
    ).bind(id, now, now),
    notice(
      env.UGC_DB,
      "INTAKE_INVITATION",
      `intake:${id}:invite`,
      id,
      body.inquiryId || null,
      {
      projectRef: text(body.projectRef, 120),
      expiresAt: expires,
      },
    ),
    audit(env.UGC_DB, "PROJECT_ACCESS_CREATED", "PROJECT_TOKEN", id, {
      expiresAt: expires,
    }),
    ...(body.inquiryId
      ? [
          env.UGC_DB.prepare(
            "UPDATE ugc_inquiries SET status='INTAKE_SENT',updated_at=? WHERE id=?",
          ).bind(now, body.inquiryId),
          env.UGC_DB.prepare(
            "INSERT INTO ugc_status_history(id,inquiry_id,status,detail_json,created_at) VALUES(?,?,?,?,?)",
          ).bind(crypto.randomUUID(), body.inquiryId, "INTAKE_SENT", "{}", now),
        ]
      : []),
  ]);
  return api(
    {
      ok: true,
      projectAccessId: id,
      expiresAt: expires,
      url: `${publicSiteUrl(env)}/ugc/project/#${token}`,
    },
    201,
  );
}

async function projectRecord(env, rawToken) {
  const token = String(rawToken || "");
  if (token.length < 32) return null;
  const hash = await sha256(token);
  const row = await env.UGC_DB.prepare(
    `SELECT t.*,b.draft_json,b.status brief_status,b.revision FROM ugc_project_tokens t JOIN ugc_project_briefs b ON b.project_token_id=t.id WHERE t.token_hash=?`,
  )
    .bind(hash)
    .first();
  if (
    !row ||
    row.status !== "ACTIVE" ||
    row.revoked_at ||
    Date.parse(row.expires_at) <= Date.now()
  )
    return null;
  return row;
}
async function getBrief(request, env, token) {
  const row = await projectRecord(env, token);
  if (!row)
    return api(
      { error: "This project link is invalid, expired, or revoked." },
      404,
      request,
      env,
    );
  const now = new Date().toISOString();
  await env.UGC_DB.batch([
    env.UGC_DB.prepare(
      "UPDATE ugc_project_tokens SET opened_at=COALESCE(opened_at,?),updated_at=? WHERE id=?",
    ).bind(now, now, row.id),
    audit(env.UGC_DB, "PRIVATE_INTAKE_OPENED", "PROJECT_TOKEN", row.id, {}),
  ]);
  return api(
    {
      projectRef: row.project_ref,
      expiresAt: row.expires_at,
      status: row.brief_status,
      revision: row.revision,
      draft: JSON.parse(row.draft_json || "{}"),
    },
    200,
    request,
    env,
  );
}
async function saveBrief(request, env, token) {
  const gate = await publicGate(request, env);
  if (gate) return gate;
  const row = await projectRecord(env, token);
  if (!row)
    return api(
      { error: "This project link is invalid, expired, or revoked." },
      404,
      request,
      env,
    );
  if (row.brief_status === "SUBMITTED")
    return api(
      { error: "This brief has already been submitted." },
      409,
      request,
      env,
    );
  const body = await readJson(request),
    expectedRevision = Number(body?.expectedRevision),
    brief = body && typeof body === "object" ? { ...body } : {};
  delete brief.expectedRevision;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
    return api({ error: "Reload this brief before saving." }, 409, request, env);
  const checked = validateBrief(brief, false),
    now = new Date().toISOString();
  const result = await env.UGC_DB.prepare(
    `UPDATE ugc_project_briefs SET draft_json=?,revision=revision+1,updated_at=? WHERE project_token_id=? AND status='DRAFT' AND revision=?`,
  )
    .bind(JSON.stringify(checked.data), now, row.id, expectedRevision)
    .run();
  if (!result.meta?.changes)
    return api(
      { error: "This brief changed elsewhere. Reload before saving again." },
      409,
      request,
      env,
    );
  return api(
    { ok: true, savedAt: now, revision: expectedRevision + 1 },
    200,
    request,
    env,
  );
}
async function completeBrief(request, env, token) {
  const gate = await publicGate(request, env);
  if (gate) return gate;
  const row = await projectRecord(env, token);
  if (!row)
    return api(
      { error: "This project link is invalid, expired, or revoked." },
      404,
      request,
      env,
    );
  if (row.brief_status === "SUBMITTED")
    return api(
      { ok: true, redirect: "/ugc/project/complete/" },
      200,
      request,
      env,
    );
  const body = await readJson(request),
    expectedRevision = Number(body?.expectedRevision),
    brief = body && typeof body === "object" ? { ...body } : {};
  delete brief.expectedRevision;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
    return api({ error: "Reload this brief before submitting." }, 409, request, env);
  const checked = validateBrief(brief, true);
  if (!checked.ok)
    return api(
      { error: "Complete the highlighted fields.", fields: checked.errors },
      422,
      request,
      env,
    );
  const proposal = JSON.parse(row.proposal_snapshot_json || "{}"),
    conflicts = scopeConflicts(proposal, checked.data),
    missing = [],
    now = new Date().toISOString(),
    assets = cleanList(checked.data.assetLinks).map((url) => ({
      url: text(url, 1000),
      ownership: "CLIENT_CONFIRMED",
      status: "REFERENCE_LINK",
    })),
    vantagePacket = prepareVantagePacket(
      checked.data,
      proposal,
      conflicts,
      assets,
    );
  const guard = `EXISTS(SELECT 1 FROM ugc_project_briefs WHERE project_token_id=? AND status='SUBMITTED' AND revision=? AND updated_at=?)`,
    newRevision = expectedRevision + 1,
    batch = await env.UGC_DB.batch([
    env.UGC_DB.prepare(
      `UPDATE ugc_project_briefs SET draft_json=?,completeness_json=?,conflicts_json=?,asset_inventory_json=?,vantage_packet_json=?,status='SUBMITTED',submitted_at=?,updated_at=?,revision=revision+1 WHERE project_token_id=? AND status='DRAFT' AND revision=?`,
    ).bind(
      JSON.stringify(checked.data),
      JSON.stringify({ complete: missing.length === 0, missing }),
      JSON.stringify(conflicts),
      JSON.stringify(assets),
      JSON.stringify(vantagePacket),
      now,
      now,
      row.id,
      expectedRevision,
    ),
    env.UGC_DB.prepare(
      `UPDATE ugc_project_tokens SET completed_at=?,updated_at=? WHERE id=? AND ${guard}`,
    ).bind(now, now, row.id, row.id, newRevision, now),
    env.UGC_DB.prepare(
      `INSERT INTO ugc_integration_outbox(id,event_type,subject_id,idempotency_key,payload_json,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`,
    ).bind(crypto.randomUUID(),"PRIVATE_INTAKE_COMPLETED",row.id,`project:${row.id}:intake-complete`,JSON.stringify({projectAccessId:row.id,projectRef:row.project_ref,conflicts,productionBlocked:true}),now,now,row.id,newRevision,now),
    env.UGC_DB.prepare(
      `INSERT INTO ugc_notification_outbox(id,intent_key,notification_type,recipient_ref,inquiry_id,template_data_json,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`,
    ).bind(crypto.randomUUID(),`intake:${row.id}:complete`,"INTAKE_COMPLETION",row.id,row.inquiry_id||null,JSON.stringify({projectRef:row.project_ref}),now,now,row.id,newRevision,now),
    env.UGC_DB.prepare(
      `INSERT INTO ugc_audit_events(id,event_type,subject_type,subject_id,detail_json,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`,
    ).bind(crypto.randomUUID(),"PROJECT_BRIEF_SUBMITTED","PROJECT_TOKEN",row.id,JSON.stringify({conflictCount:conflicts.length,productionBlocked:true}),now,row.id,newRevision,now),
    ...(row.inquiry_id
      ? [
          env.UGC_DB.prepare(
            `UPDATE ugc_inquiries SET status='INTAKE_RECEIVED',updated_at=? WHERE id=? AND ${guard}`,
          ).bind(now, row.inquiry_id, row.id, newRevision, now),
          env.UGC_DB.prepare(
            `INSERT INTO ugc_status_history(id,inquiry_id,status,detail_json,created_at) SELECT ?,?,?,?,? WHERE ${guard}`,
          ).bind(
            crypto.randomUUID(),
            row.inquiry_id,
            "INTAKE_RECEIVED",
            JSON.stringify({ projectAccessId: row.id }),
            now,
            row.id,
            newRevision,
            now,
          ),
        ]
      : []),
  ]);
  if (!batch[0]?.meta?.changes)
    return api(
      { error: "This brief changed elsewhere. Reload before submitting." },
      409,
      request,
      env,
    );
  return api(
    {
      ok: true,
      redirect: "/ugc/project/complete/",
      conflictCount: conflicts.length,
    },
    201,
    request,
    env,
  );
}

export function scopeConflicts(proposal, brief) {
  const conflicts = [];
  const checks = [
    ["videoCount", "Video count"],
    ["productionMethod", "Production method"],
    ["usageKind", "Usage type"],
    ["usageDuration", "Usage duration"],
    ["rawFootageRequested", "Raw footage"],
    ["exclusivityRequested", "Exclusivity"],
    ["perpetualUseRequested", "Perpetual use"],
  ];
  for (const [key, label] of checks)
    if (
      proposal[key] !== undefined &&
      String(proposal[key]) !== String(brief[key])
    )
      conflicts.push({
        field: key,
        label,
        proposal: proposal[key],
        requested: brief[key],
        requiresApproval: true,
      });
  return conflicts;
}

export function prepareVantagePacket(brief, proposal, conflicts, assets) {
  const requestedClaims = Array.isArray(brief.claims) ? brief.claims : [];
  const blockers = [
    "HUMAN_APPROVAL_REQUIRED",
    "PAYMENT_STATUS_NOT_VERIFIED",
    "CLAIMS_REQUIRE_REVIEW",
  ];
  if (conflicts.length) blockers.push("SCOPE_CONFLICTS");
  if (!assets.length) blockers.push("ASSETS_NOT_RECEIVED");
  return {
    version: 1,
    completeness: { complete: true, missing: [] },
    conflicts,
    productSummary: {
      name: text(brief.productName, 240),
      category: text(brief.productCategory, 160),
      description: text(brief.productDescription, 2000),
      primaryBenefit: text(brief.primaryBenefit, 1000),
    },
    audienceSummary: {
      customer: text(
        brief.audienceTargetCustomer || brief.targetCustomer,
        1000,
      ),
      painPoint: text(brief.primaryPainPoint || brief.mainProblem, 1000),
      objection: text(brief.primaryObjection, 1000),
    },
    campaignObjective: text(brief.campaignObjective, 160),
    claims: requestedClaims.map((claim) => ({
      ...claim,
      approval: "PENDING_HUMAN_REVIEW",
    })),
    usageRights: {
      kind: brief.usageKind,
      duration: brief.usageDuration,
      territory: brief.territory,
      platforms: cleanList(brief.publishingPlatforms),
      whitelisting: brief.whitelistingRequest === true,
      exclusivity: brief.exclusivityRequested === true,
      perpetual: brief.perpetualUseRequested === true,
    },
    productionMethod: {
      requested: brief.productionMethod,
      availability: "UNCONFIRMED",
    },
    assetInventory: assets,
    proposalSnapshot: proposal,
    recommendedCreativeFormat: text(brief.requestedFormat, 240),
    hookRecommendations: [
      `Lead with the problem: ${text(brief.mainProblem, 180)}`,
      `Demonstrate the primary benefit: ${text(brief.primaryBenefit, 180)}`,
      `Answer the main objection: ${text(brief.primaryObjection || "address the buyer's biggest hesitation", 180)}`,
    ],
    draftProductionBrief: {
      format: brief.requestedFormat,
      tone: brief.tone,
      deliverables: {
        count: brief.videoCount,
        length: brief.videoLength,
        aspectRatio: brief.aspectRatio,
        fileFormat: brief.fileFormat,
      },
      requiredTalkingPoints: brief.requiredTalkingPoints || "",
      requiredVisuals: brief.requiredVisuals || "",
      cta: brief.desiredCta || brief.desiredAction,
    },
    productionTasks: [
      "VERIFY_PAYMENT",
      "REVIEW_CLAIMS",
      "VERIFY_ASSETS",
      "REVIEW_SCOPE",
      "CONFIRM_PRODUCTION_METHOD",
      "CONFIRM_DEADLINE",
      "REQUEST_HUMAN_APPROVAL",
    ],
    deadlinePlan: {
      requestedDeliveryDate: brief.requestedDeliveryDate,
      campaignLaunchDate: brief.launchDate || null,
      feasibility: "PENDING_HUMAN_REVIEW",
    },
    humanApprovalRequest: { required: true, productionBlocked: true, blockers },
  };
}
async function revokeProject(request, env, id) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const now = new Date().toISOString(),
    result = await env.UGC_DB.prepare(
      `UPDATE ugc_project_tokens SET status='REVOKED',revoked_at=?,updated_at=? WHERE id=? AND status='ACTIVE'`,
    )
      .bind(now, now, id)
      .run();
  return api(
    { ok: Boolean(result.meta?.changes) },
    result.meta?.changes ? 200 : 404,
  );
}
async function readOutbox(request, env) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const rows = await env.UGC_DB.prepare(
    `SELECT id,event_type,subject_id,idempotency_key,payload_json,created_at FROM ugc_integration_outbox WHERE status='PENDING' ORDER BY created_at LIMIT 50`,
  ).all();
  return api({ events: rows.results || [] });
}
async function acknowledgeOutbox(request, env) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const body = await readJson(request);
  if (!body || !Array.isArray(body.ids))
    return api({ error: "Event IDs are required." }, 422);
  const now = new Date().toISOString();
  const statements = body.ids.slice(0, 50).map((id) =>
    env.UGC_DB.prepare(
      `UPDATE ugc_integration_outbox SET status='ACKNOWLEDGED',acknowledged_at=?,updated_at=? WHERE id=? AND status='PENDING'`,
    )
      .bind(now, now, text(id, 80)),
  );
  if (statements.length) await env.UGC_DB.batch(statements);
  return api({ ok: true });
}

async function listInquiries(request, env, url) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const status = text(url.searchParams.get("status"), 40),
    query = text(url.searchParams.get("q"), 120),
    owner = text(url.searchParams.get("owner"), 120),
    clauses = [],
    values = [];
  if (status) {
    clauses.push("status=?");
    values.push(status);
  }
  if (query) {
    clauses.push(
      "(id LIKE ? OR company LIKE ? OR email LIKE ? OR product_name LIKE ?)",
    );
    for (let i = 0; i < 4; i++) values.push(`%${query}%`);
  }
  if (owner) {
    clauses.push("owner=?");
    values.push(owner);
  }
  const sql = `SELECT id,status,company,product_name,budget,usage_kind,completion_window,owner,qualification_json,created_at,updated_at FROM ugc_inquiries ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 100`;
  const prepared = env.UGC_DB.prepare(sql);
  const rows = await (
    values.length ? prepared.bind(...values) : prepared
  ).all();
  return api({ inquiries: rows.results || [] });
}
async function getInquiry(request, env, id) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const row = await env.UGC_DB.prepare("SELECT * FROM ugc_inquiries WHERE id=?")
    .bind(text(id, 80))
    .first();
  return row ? api({ inquiry: row }) : api({ error: "Not found" }, 404);
}
async function updateInquiry(request, env, id) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const body = await readJson(request);
  if (!body) return api({ error: "Invalid request." }, 400);
  const key = text(id, 80),
    existing = await env.UGC_DB.prepare(
      "SELECT id,status,production_clearance_json FROM ugc_inquiries WHERE id=?",
    )
      .bind(key)
      .first();
  if (!existing) return api({ error: "Not found" }, 404);
  const allowedStatus = new Set([
    "NEW_INQUIRY",
    "QUALIFICATION",
    "RESPONSE_DRAFTED",
    "AWAITING_APPROVAL",
    "CONTACTED",
    "DISCOVERY",
    "PROPOSAL_SENT",
    "WON",
    "INTAKE_SENT",
    "INTAKE_RECEIVED",
    "BRIEF_REVIEW",
    "READY_FOR_PRODUCTION",
    "ARCHIVED",
  ]);
  const clearanceKeys = [
    "payment",
    "information",
    "claims",
    "usage",
    "assets",
    "productionMethod",
    "deadline",
    "compliance",
    "humanApproval",
  ];
  let storedClearance = {};
  try {
    storedClearance = JSON.parse(existing.production_clearance_json || "{}");
  } catch {}
  const effectiveStatus = body.status ?? existing.status,
    effectiveClearance = body.productionClearance ?? storedClearance;
  if (
    effectiveStatus === "READY_FOR_PRODUCTION" &&
    clearanceKeys.some((clearance) => effectiveClearance[clearance] !== true)
  )
    return api(
      {
        error:
          "Every production clearance and human approval must be recorded first.",
        requiredClearances: clearanceKeys,
      },
      422,
    );
  const fields = [],
    values = [];
  if (body.status !== undefined) {
    if (!allowedStatus.has(body.status))
      return api({ error: "Invalid status." }, 422);
    fields.push("status=?");
    values.push(body.status);
  }
  if (body.owner !== undefined) {
    fields.push("owner=?");
    values.push(text(body.owner, 120) || null);
  }
  if (body.qualification !== undefined) {
    fields.push("qualification_json=?");
    values.push(JSON.stringify(body.qualification));
  }
  if (body.approvalDecision !== undefined) {
    fields.push("approval_decision_json=?");
    values.push(JSON.stringify(body.approvalDecision));
  }
  if (body.productionClearance !== undefined) {
    fields.push("production_clearance_json=?");
    values.push(JSON.stringify(body.productionClearance));
  }
  if (!fields.length) return api({ error: "No supported changes." }, 422);
  const now = new Date().toISOString();
  fields.push("updated_at=?");
  values.push(now, key);
  const results = await env.UGC_DB.batch([
    env.UGC_DB.prepare(
      `UPDATE ugc_inquiries SET ${fields.join(",")} WHERE id=?`,
    ).bind(...values),
    env.UGC_DB.prepare(
      "INSERT INTO ugc_status_history(id,inquiry_id,status,detail_json,created_at) VALUES(?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      key,
      body.status || "METADATA_UPDATED",
      JSON.stringify({
        owner: body.owner || null,
        approvalRecorded: body.approvalDecision !== undefined,
      }),
      now,
    ),
    audit(env.UGC_DB, "INQUIRY_UPDATED", "INQUIRY", key, {
      status: body.status || null,
    }),
  ]);
  if (!results[0]?.meta?.changes) return api({ error: "Not found" }, 404);
  return api({ ok: true, updatedAt: now });
}
async function deleteInquiry(request, env, id) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const key = text(id, 80);
  const linked = await env.UGC_DB.prepare(
    "SELECT COUNT(*) count FROM ugc_project_tokens WHERE inquiry_id=?",
  )
    .bind(key)
    .first();
  if (Number(linked?.count || 0) > 0)
    return api(
      { error: "Archive inquiries with linked projects; deletion is blocked." },
      409,
    );
  const existing = await env.UGC_DB.prepare(
    "SELECT id FROM ugc_inquiries WHERE id=?",
  )
    .bind(key)
    .first();
  if (!existing) return api({ error: "Not found" }, 404);
  await env.UGC_DB.batch([
    env.UGC_DB.prepare(
      "DELETE FROM ugc_notification_outbox WHERE inquiry_id=?",
    ).bind(key),
    env.UGC_DB.prepare(
      "DELETE FROM ugc_status_history WHERE inquiry_id=?",
    ).bind(key),
    env.UGC_DB.prepare("DELETE FROM ugc_inquiries WHERE id=?").bind(key),
  ]);
  return api({ ok: true });
}
async function adminBrief(request, env, id) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const row = await env.UGC_DB.prepare(
    `SELECT t.id,t.inquiry_id,t.project_ref,t.status token_status,t.expires_at,t.revoked_at,t.proposal_snapshot_json,b.revision,b.draft_json,b.completeness_json,b.conflicts_json,b.asset_inventory_json,b.vantage_packet_json,b.status,b.submitted_at,b.updated_at FROM ugc_project_tokens t JOIN ugc_project_briefs b ON b.project_token_id=t.id WHERE t.id=?`,
  )
    .bind(text(id, 80))
    .first();
  if (!row) return api({ error: "Not found" }, 404);
  return api({
    brief: row,
    productionBlocked:
      row.status !== "SUBMITTED" ||
      JSON.parse(row.conflicts_json || "[]").length > 0,
  });
}
async function readNotifications(request, env) {
  if (!admin(request, env)) return api({ error: "Unauthorized" }, 401);
  const rows = await env.UGC_DB.prepare(
    `SELECT id,intent_key,notification_type,recipient_ref,template_data_json,status,attempt_count,last_error,created_at,updated_at FROM ugc_notification_outbox ORDER BY created_at DESC LIMIT 100`,
  ).all();
  return api({ notifications: rows.results || [], deliveryConfigured: false });
}

async function publicGate(request, env) {
  if (!allowedOrigin(request, env))
    return api({ error: "Origin not allowed." }, 403, request, env);
  if (
    !String(request.headers.get("content-type") || "").startsWith(
      "application/json",
    )
  )
    return api({ error: "Use JSON." }, 415, request, env);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY)
    return api({ error: "Request is too large." }, 413, request, env);
  if (!(await validCsrf(request, env)))
    return api(
      { error: "Form security check failed. Refresh and try again." },
      403,
      request,
      env,
    );
  return null;
}
async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
async function csrfResponse(request, env) {
  if (!allowedOrigin(request, env))
    return api({ error: "Origin not allowed." }, 403, request, env);
  const secret = csrfSecret(env);
  if (!secret)
    return api({ error: "UGC security is not configured." }, 503, request, env);
  const expires = Date.now() + 30 * 60 * 1000,
    nonce = randomToken(18),
    value = `${expires}.${nonce}`,
    signature = await hmac(value, secret);
  const token = `${value}.${signature}`;
  const response = api({ token }, 200, request, env);
  response.headers.append(
    "Set-Cookie",
    `ugc_csrf=${token}; Path=/api/ugc; Secure; SameSite=Strict; Max-Age=1800`,
  );
  return response;
}
async function validCsrf(request, env) {
  const secret = csrfSecret(env);
  if (!secret) return false;
  const header = request.headers.get("X-UGC-CSRF") || "",
    cookie = parseCookie(request, "ugc_csrf");
  if (!header || header !== cookie) return false;
  const parts = header.split(".");
  if (parts.length !== 3 || Number(parts[0]) < Date.now()) return false;
  return safeEqual(
    parts[2],
    await hmac(`${parts[0]}.${parts[1]}`, secret),
  );
}
function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const allowed = new Set([
    publicSiteUrl(env),
    ...String(env.UGC_ALLOWED_ORIGINS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ]);
  return allowed.has(origin);
}
function cors(request, env) {
  const h = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type,Idempotency-Key,X-UGC-CSRF,X-UGC-Project-Token",
    "Access-Control-Max-Age": "600",
  });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigin(request, env))
    h.set("Access-Control-Allow-Origin", origin);
  return h;
}
async function consumeRate(db, key) {
  const start = new Date(
    Math.floor(Date.now() / 3600000) * 3600000,
  ).toISOString(),
    cutoff = new Date(Date.now() - 48 * 3600000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM ugc_rate_windows WHERE window_start<?").bind(cutoff),
    db.prepare(
      `INSERT INTO ugc_rate_windows(abuse_key,window_start,attempt_count) VALUES(?,?,1) ON CONFLICT(abuse_key,window_start) DO UPDATE SET attempt_count=attempt_count+1`,
    )
      .bind(key, start),
  ]);
  const row = await db
    .prepare(
      "SELECT attempt_count FROM ugc_rate_windows WHERE abuse_key=? AND window_start=?",
    )
    .bind(key, start)
    .first();
  return Number(row?.attempt_count || 0) <= 8;
}
async function abuseHash(request, env) {
  const secret = abuseSecret(env);
  if (!secret) return "";
  const raw = request.headers.get("CF-Connecting-IP") || "unknown";
  return hmac(raw, secret);
}
function csrfSecret(env) {
  const value = String(env.UGC_CSRF_SECRET || ""),
    abuse = String(env.UGC_ABUSE_SECRET || ""),
    shared = String(env.SESSION_SECRET || "");
  return value.length >= 32 &&
    abuse.length >= 32 &&
    value !== abuse &&
    value !== shared
    ? value
    : "";
}
function abuseSecret(env) {
  const value = String(env.UGC_ABUSE_SECRET || ""),
    csrf = String(env.UGC_CSRF_SECRET || ""),
    shared = String(env.SESSION_SECRET || "");
  return value.length >= 32 &&
    csrf.length >= 32 &&
    value !== csrf &&
    value !== shared
    ? value
    : "";
}
function projectToken(request) {
  return String(request.headers.get("X-UGC-Project-Token") || "");
}
function publicSiteUrl(env) {
  const value = String(
    env.UGC_PUBLIC_SITE_URL || "https://echov4ult.com",
  ).replace(/\/$/, "");
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
      ? parsed.origin
      : "https://echov4ult.com";
  } catch {
    return "https://echov4ult.com";
  }
}
function admin(request, env) {
  const expected = String(env.UGC_SYNC_SECRET || ""),
    actual = String(request.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
  return expected.length >= 32 && safeEqual(actual, expected);
}
function outbox(db, type, subject, key, payload) {
  const now = new Date().toISOString();
  return db
    .prepare(
      `INSERT INTO ugc_integration_outbox(id,event_type,subject_id,idempotency_key,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      type,
      subject,
      key,
      JSON.stringify(payload),
      now,
      now,
    );
}
function notice(db, type, key, recipient, inquiryId, payload) {
  const now = new Date().toISOString();
  return db
    .prepare(
      `INSERT INTO ugc_notification_outbox(id,intent_key,notification_type,recipient_ref,inquiry_id,template_data_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      key,
      type,
      recipient,
      inquiryId,
      JSON.stringify(payload),
      now,
      now,
    );
}
function audit(db, type, subjectType, subjectId, detail) {
  return db
    .prepare(
      `INSERT INTO ugc_audit_events(id,event_type,subject_type,subject_id,detail_json,created_at) VALUES(?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      type,
      subjectType,
      subjectId,
      JSON.stringify(detail),
      new Date().toISOString(),
    );
}
function api(value, status = 200, request, env) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (request && env)
    for (const [k, v] of cors(request, env)) headers.set(k, v);
  return new Response(JSON.stringify(value), { status, headers });
}
function requiredText(value, errors, keys) {
  for (const key of keys)
    if (!text(value?.[key], 4000)) errors[key] = "This field is required.";
}
function validEmail(value) {
  return (
    /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/u.test(String(value || "").trim()) &&
    String(value || "").length <= 254
  );
}
function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}
function validIdempotency(value) {
  return /^[A-Za-z0-9_-]{16,100}$/.test(String(value || ""));
}
function text(value, max) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
function cleanList(value) {
  return Array.isArray(value)
    ? value
        .map((x) => text(x, 1000))
        .filter(Boolean)
        .slice(0, 30)
    : [];
}
function parseCookie(request, name) {
  for (const item of String(request.headers.get("Cookie") || "").split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}
function randomToken(bytes) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
async function sha256(value) {
  return base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))),
  );
}
async function hmac(value, secret) {
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))),
  );
}
function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
