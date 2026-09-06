import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const siteRoot = normalize(join(fileURLToPath(new URL(".", import.meta.url)), "../.."));
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};
let server;
let baseUrl;

before(async () => {
  server = createServer((request, response) => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    let target = normalize(join(siteRoot, decodeURIComponent(pathname)));
    if (!target.startsWith(siteRoot)) {
      response.writeHead(403).end();
      return;
    }
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
    if (!existsSync(target)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": contentTypes[extname(target)] || "application/octet-stream" });
    createReadStream(target).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function fillInquiry(page) {
  await page.getByLabel("Name *").fill("Test Customer");
  await page.getByLabel("Work email *").fill("test@example.com");
  await page.getByLabel("Company or brand *").fill("Test Brand");
  await page.getByLabel(/Company website or product page/).fill("https://example.com");
  await page.getByLabel(/Product, service, or app/).fill("Test Controller");
  await page.getByLabel(/Product or website URL/).fill("https://example.com/product");
  await page.getByLabel("Product demonstration").check();
  await page.getByLabel(/Approximate number of videos/).selectOption({ index: 1 });
  await page.getByLabel(/Desired completion window/).selectOption({ index: 1 });
  await page.getByLabel(/Estimated budget/).selectOption({ index: 1 });
  await page.getByLabel("Organic TikTok").check();
  await page.getByLabel(/Expected usage/).selectOption({ index: 1 });
  await page.getByLabel(/Primary goal/).fill("Show the product clearly.");
  await page.getByLabel(/I understand that submission/).check();
}

async function fillProjectBrief(page) {
  await page.evaluate(() => {
    const seenRadios = new Set();
    document.querySelectorAll("input,select,textarea").forEach((control) => {
      if (!control.name || control.disabled) return;
      if (control.type === "checkbox") {
        control.checked = control.required;
      } else if (control.type === "radio") {
        if (!seenRadios.has(control.name)) {
          control.checked = true;
          seenRadios.add(control.name);
        }
      } else if (control.tagName === "SELECT") {
        const option = Array.from(control.options).find((item) => item.value);
        if (option) control.value = option.value;
      } else if (control.type === "email") {
        control.value = "client@example.com";
      } else if (control.type === "url") {
        control.value = "https://example.com/evidence";
      } else if (control.type === "date") {
        control.value = "2030-01-01";
      } else if (control.type === "number") {
        control.value = "2";
      } else {
        control.value = "Test project detail";
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  await page.locator('select[name="productType"]').selectOption("software", { force: true });
  await page.locator('textarea[name="softwareAccess"]').fill("A test account will be supplied securely.", { force: true });
}

test("public inquiry validates errors, retries, and redirects after success", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let attempts = 0;
    await page.route("**/api/ugc/csrf", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "test-csrf" }),
    }));
    await page.route("**/api/ugc/inquiries", async (route) => {
      attempts += 1;
      const body = route.request().postDataJSON();
      assert.equal(body.email, "test@example.com");
      if (attempts === 1) {
        await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "Check the highlighted fields.", fields: { objective: "Be more specific." } }) });
        return;
      }
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ redirect: "/ugc/thank-you/" }) });
    });
    await page.goto(`${baseUrl}/ugc/inquiry/`);
    await page.getByRole("button", { name: /send project inquiry/i }).click();
    assert.ok(await page.locator(":invalid").count());
    await fillInquiry(page);
    await page.getByRole("button", { name: /send project inquiry/i }).click();
    await page.getByText("Be more specific.").waitFor();
    await page.getByRole("button", { name: /send project inquiry/i }).click();
    await page.waitForURL("**/ugc/thank-you/");
    assert.equal(attempts, 2);
  } finally {
    await browser.close();
  }
});

test("private brief hides its token, authenticates by header, and handles save failure", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const token = "p".repeat(43);
    let projectHeader = "";
    await page.route("**/api/ugc/projects/current", async (route) => {
      projectHeader = route.request().headers()["x-ugc-project-token"] || "";
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projectRef: "PROJECT-42", draft: {}, status: "DRAFT", revision: 4 }) });
        return;
      }
      assert.equal(route.request().postDataJSON().expectedRevision, 4);
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary save failure." }) });
    });
    await page.route("**/api/ugc/csrf", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "test-csrf" }) }));
    await page.goto(`${baseUrl}/ugc/project/#${token}`);
    await page.getByText("PROJECT-42").waitFor();
    assert.equal(projectHeader, token);
    assert.equal(new URL(page.url()).hash, "");
    await page.getByRole("button", { name: /save draft/i }).click();
    await page.getByText("Temporary save failure.").waitFor();
  } finally {
    await browser.close();
  }
});

test("private brief completes all steps with revision-safe save and submit", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(), token = "h".repeat(43);
    let savedRevision, submittedRevision;
    await page.route("**/api/ugc/projects/current", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projectRef: "PROJECT-HAPPY", draft: {}, status: "DRAFT", revision: 4 }) });
        return;
      }
      savedRevision = route.request().postDataJSON().expectedRevision;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, savedAt: "2030-01-01T12:00:00.000Z", revision: 5 }) });
    });
    await page.route("**/api/ugc/projects/current/complete", async (route) => {
      submittedRevision = route.request().postDataJSON().expectedRevision;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ redirect: "/ugc/project/complete/" }) });
    });
    await page.route("**/api/ugc/csrf", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "test-csrf" }) }));
    await page.goto(`${baseUrl}/ugc/project/#${token}`);
    await page.getByText("PROJECT-HAPPY").waitFor();
    await fillProjectBrief(page);
    await page.getByRole("button", { name: /save draft/i }).click();
    await page.getByText(/Draft saved/).waitFor();
    assert.equal(savedRevision, 4);
    for (let step = 2; step <= 10; step += 1)
      await page.evaluate(() => document.querySelector("#step-next").click());
    await page.getByText("Step 10 of 10").waitFor();
    await page.locator("#submit-brief").click();
    await page.waitForURL("**/ugc/project/complete/");
    assert.equal(submittedRevision, 5);
  } finally {
    await browser.close();
  }
});

test("private brief shows a CAS conflict without clearing entered work", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(), token = "c".repeat(43);
    await page.route("**/api/ugc/projects/current", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projectRef: "PROJECT-CONFLICT", draft: {}, status: "DRAFT", revision: 8 }) });
        return;
      }
      assert.equal(route.request().postDataJSON().expectedRevision, 8);
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "This brief changed elsewhere. Reload before saving again." }) });
    });
    await page.route("**/api/ugc/csrf", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "test-csrf" }) }));
    await page.goto(`${baseUrl}/ugc/project/#${token}`);
    const brand = page.locator('input[name="brandName"]');
    await brand.fill("Unsaved client edit");
    await page.getByRole("button", { name: /save draft/i }).click();
    await page.getByText(/changed elsewhere/).waitFor();
    assert.equal(await brand.inputValue(), "Unsaved client edit");
  } finally {
    await browser.close();
  }
});
