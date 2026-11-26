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

test("analysis is explicit, saved on reload and separate for another search", async ({ page }) => {
  await search(page);
  const first = page.getByRole("article").first();
  await expect(first.getByText("Not analyzed yet", { exact: true })).toBeVisible();
  await first.getByRole("button", { name: "Analyze post", exact: true }).click();
  await expect(first.getByText("Relevant", { exact: true })).toBeVisible();
  await expect(first.getByText("Simulated analysis — no AI inference", { exact: true })).toBeVisible();
  await expect(first.getByText("Standard reply allowed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(first.getByText("Relevant", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/analysis-preview.png", fullPage: true });
  await expect(first.getByRole("button", { name: "Analyze post", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "New search" }).click();
  await page.getByLabel("Keywords or hashtags").fill("daughter");
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(first.getByText("Not analyzed yet", { exact: true })).toBeVisible();
  await expect(first.getByText("Relevant", { exact: true })).toHaveCount(0);
});

test("analysis failure preserves the post, prevents duplicate submission and allows retry", async ({ page }) => {
  await search(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route("**/api/analysis", async (route) => {
    calls++; await pending;
    await route.fulfill({ status: 429, contentType: "application/json", headers: { "Retry-After": "30" },
      body: JSON.stringify({ error: "Request limit reached." }) });
  }, { times: 1 });
  const first = page.getByRole("article").first();
  await first.getByRole("button", { name: "Analyze post", exact: true }).click();
  await expect(first.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  release();
  await expect(first.getByRole("alert")).toContainText("30 seconds");
  await expect(first).toContainText("Our daughter arrived yesterday.");
  expect(calls).toBe(1);
  await first.getByRole("button", { name: "Retry analysis" }).click();
  await expect(first.getByText("Relevant", { exact: true })).toBeVisible();
});

test("bereavement analysis permits condolences only, without a commercial invitation", async ({ page }) => {
  await search(page, "grief");
  const first = page.getByRole("article").first();
  await first.getByRole("button", { name: "Analyze post", exact: true }).click();
  await expect(first.getByText("Condolence only — no commercial outreach", { exact: true })).toBeVisible();
  await expect(first.getByText("Bereavement", { exact: true })).toBeVisible();
  await expect(first.getByRole("button", { name: /generate/i })).toHaveCount(0);
});

test("analysis API rejects signed-out, cross-origin and forged decisions", async ({ request }) => {
  const data = { resultId: "00000000-0000-4000-8000-000000000099" };
  const headers = { Origin: "http://127.0.0.1:3100" };
  expect((await request.post("/api/analysis", { data, headers })).status()).toBe(401);
  expect((await request.post("/api/analysis", { data, headers: { Origin: "https://other.example" } })).status()).toBe(403);
  expect((await request.post("/api/analysis", { data: { ...data, analysis: { relevance: "relevant" }, AI_PROVIDER: "mock" }, headers })).status()).toBe(400);
});
