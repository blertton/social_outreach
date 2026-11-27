import { expect, test, type Page } from "@playwright/test";

async function search(page: Page, query = "baby") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("reviewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await page.getByLabel("Keywords or hashtags").fill(query);
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page).toHaveURL(/\/searches\/[a-f0-9-]+$/);
}

test("search and reload spend no AI allowance until a post is explicitly analyzed", async ({ page }) => {
  let calls = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/analysis")) calls++; });
  await search(page);
  const first = page.getByRole("article").first();
  await expect(first.getByRole("button", { name: "Analyze post", exact: true })).toBeVisible();
  await page.reload();
  await expect(first.getByRole("button", { name: "Analyze post", exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await first.getByRole("button", { name: "Analyze post", exact: true }).click();
  await expect(first.getByText("Relevant", { exact: true })).toBeVisible();
  await expect(first.getByText("Simulated analysis — no AI inference", { exact: true })).toBeVisible();
  await expect(first.getByText("Standard reply allowed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(first.getByText("Relevant", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/analysis-preview.png", fullPage: true });
  await expect(first.getByRole("button", { name: "Analyze post", exact: true })).toHaveCount(0);
  expect(calls).toBe(1);
  await page.getByRole("link", { name: "New search" }).click();
  await page.getByLabel("Keywords or hashtags").fill("daughter");
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(first.getByRole("button", { name: "Analyze post", exact: true })).toBeVisible();
  expect(calls).toBe(1);
});

test("analysis failure preserves the post, prevents duplicate submission and allows retry", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route("**/api/analysis", async (route) => {
    calls++; await pending;
    await route.fulfill({ status: 429, contentType: "application/json", headers: { "Retry-After": "30" },
      body: JSON.stringify({ error: "Request limit reached." }) });
  }, { times: 1 });
  await search(page);
  await page.getByRole("button", { name: "Analyze all posts", exact: true }).click();
  const first = page.getByRole("article").first();
  await expect(page.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  release();
  await expect(page.getByRole("alert").filter({ hasText: "Request limit" })).toContainText("30 seconds");
  await expect(first).toContainText("Our daughter arrived yesterday.");
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Retry analysis" }).click();
  await expect(first.getByText("Relevant", { exact: true })).toBeVisible();
});

test("bereavement analysis permits condolences only, without a commercial invitation", async ({ page }) => {
  await search(page, "grief");
  const first = page.getByRole("article").first();
  await first.getByRole("button", { name: "Analyze post", exact: true }).click();
  await expect(first.getByText("Condolence only — no commercial outreach", { exact: true })).toBeVisible();
  await expect(first.getByText("Bereavement", { exact: true })).toBeVisible();
  // Only the dedicated condolence path is offered; never the standard reply.
  await expect(first.getByRole("button", { name: "Generate reply", exact: true })).toHaveCount(0);
  await expect(first.getByRole("button", { name: "Generate condolence message", exact: true })).toBeVisible();
});

test("analysis API rejects signed-out, cross-origin and forged decisions", async ({ request }) => {
  const data = { searchId: "00000000-0000-4000-8000-000000000099" };
  const headers = { Origin: "http://127.0.0.1:3100" };
  expect((await request.post("/api/analysis", { data, headers })).status()).toBe(401);
  expect((await request.post("/api/analysis", { data, headers: { Origin: "https://other.example" } })).status()).toBe(403);
  expect((await request.post("/api/analysis", { data: { ...data, analysis: { relevance: "relevant" }, AI_PROVIDER: "mock" }, headers })).status()).toBe(400);
});

test("twenty pending posts need four sequential calls and no calls on reload", async ({ page, request }) => {
  await search(page, "unmatchablephrase");
  const { searchId } = await (await request.post("http://127.0.0.1:54329/test/seed-batch")).json();
  let calls = 0; let active = 0; let maximum = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/analysis")) { calls++; active++; maximum = Math.max(maximum, active); } });
  page.on("requestfinished", (r) => { if (r.url().endsWith("/api/analysis")) active--; });
  await page.goto(`/searches/${searchId}`);
  await page.getByRole("button", { name: "Analyze all posts", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "20 of 20 posts analyzed" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(20);
  expect(calls).toBe(4); expect(maximum).toBe(1);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "20 of 20 posts analyzed" })).toBeVisible();
  expect(calls).toBe(4);
});

test("relevant posts appear first and unrelated posts stay inspectable in a collapsed section", async ({ page, request }) => {
  await search(page, "unmatchablephrase");
  const { searchId } = await (await request.post("http://127.0.0.1:54329/test/seed-analysis-order")).json();
  await page.goto(`/searches/${searchId}`);
  await expect(page.getByRole("article").first()).toContainText("Our daughter arrived yesterday.");
  await expect(page.getByText("Synthetic unrelated post.", { exact: true }).first()).not.toBeVisible();
  await page.getByText("Not relevant (1)", { exact: true }).click();
  await expect(page.getByText("Synthetic unrelated post.", { exact: true }).first()).toBeVisible();
});

test("a failed requested batch stops dispatch and preserves the remaining pending posts", async ({ page, request }) => {
  await search(page, "unmatchablephrase");
  const { searchId } = await (await request.post("http://127.0.0.1:54329/test/seed-batch?fail=true")).json();
  let calls = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/analysis")) calls++; });
  await page.goto(`/searches/${searchId}`);
  await page.getByRole("button", { name: "Analyze all posts", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Analysis could not be completed" })).toBeVisible();
  await expect(page.getByText("Analysis failed. Retry the remaining posts above.", { exact: true })).toHaveCount(5);
  await expect(page.getByText("Awaiting contextual analysis", { exact: true })).toHaveCount(15);
  await expect(page.getByRole("button", { name: "Retry analysis" })).toBeEnabled();
  expect(calls).toBe(1);
});
