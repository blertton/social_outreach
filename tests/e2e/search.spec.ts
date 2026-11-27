import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("reviewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
}

test("rate limiting shows Retry-After and preserves the search", async ({ page }) => {
  await login(page);
  await page.route("**/api/search", (route) => route.fulfill({ status: 429, contentType: "application/json",
    headers: { "Retry-After": "45" }, body: JSON.stringify({ error: "Request limit reached." }) }));
  await page.getByLabel("Keywords or hashtags").fill("first home");
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Request limit" })).toContainText("45 seconds");
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("first home");
  await expect(page.getByLabel("Source", { exact: true })).toHaveValue("fixtures");
});

test("source failures never silently switch to samples; an explicit retry works", async ({ page }) => {
  await login(page);
  await page.route("**/api/search", (route) => route.fulfill({ status: 503, contentType: "application/json",
    body: JSON.stringify({ error: "Bluesky unavailable. Choose Sample data or retry." }) }), { times: 1 });
  await page.getByLabel("Keywords or hashtags").fill("baby");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Bluesky unavailable" })).toBeVisible();
  await expect(page.getByLabel("Source", { exact: true })).toHaveValue("bluesky");
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("baby");
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page).toHaveURL(/\/searches\/[a-f0-9-]+$/);
  await expect(page.getByText("Sample data — synthetic examples", { exact: true })).toBeVisible();
});

test("pending searches cannot be submitted twice", async ({ page }) => {
  await login(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route("**/api/search", async (route) => {
    calls++; await pending;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Try again." }) });
  });
  await page.getByLabel("Keywords or hashtags").fill("baby");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page.getByRole("button", { name: "Searching…" })).toBeDisabled();
  await page.getByLabel("Keywords or hashtags").press("Enter");
  release();
  await expect(page.getByRole("alert").filter({ hasText: "Try again" })).toBeVisible();
  expect(calls).toBe(1);
});

test("unknown saved searches do not expose records", async ({ page }) => {
  await login(page);
  const response = await page.goto("/searches/00000000-0000-4000-8000-000000000099");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Synthetic baby announcement")).toHaveCount(0);
});

test("search API rejects signed-out, cross-origin and forged input requests", async ({ request }) => {
  const path = "/api/search";
  const data = { query: "baby", source: "fixtures" };
  expect((await request.post(path, { data, headers: { Origin: "http://127.0.0.1:3100" } })).status()).toBe(401);
  expect((await request.post(path, { data, headers: { Origin: "https://other.example" } })).status()).toBe(403);
  expect((await request.post(path, { data: { ...data, user_id: "forged" }, headers: { Origin: "http://127.0.0.1:3100" } })).status()).toBe(400);
});

test("mobile sample search has readable results without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByLabel("Keywords or hashtags").fill("baby");
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page.getByRole("article").first()).toBeVisible();
  await page.getByRole("article").first().getByRole("button", { name: "Analyze post", exact: true }).click();
  await expect(page.getByRole("article").first().getByText("Relevant", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mobile-search.png", fullPage: true });
});
