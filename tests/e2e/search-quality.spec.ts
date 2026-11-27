import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("reviewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
});

test("users choose their own phrases without fixed topics or AI and can refine them", async ({ page }) => {
  await expect(page.getByRole("button", { name: "New parenthood", exact: true })).toHaveCount(0);
  let aiCalls = 0;
  page.on("request", (request) => { if (request.url().includes("/api/search/suggestions")) aiCalls++; });
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByLabel("Keywords or hashtags").fill("daughter arrived, baby arrived");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Our daughter arrived yesterday.");
  await expect(page.getByRole("article")).toContainText("Not analyzed yet");
  await page.screenshot({ path: "test-results/targeted-results.png", fullPage: true });
  await page.getByRole("link", { name: "Refine search" }).click();
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("daughter arrived, baby arrived");
  await expect(page.getByLabel("Source", { exact: true })).toHaveValue("fixtures");
  expect(aiCalls).toBe(0);
});

test("optional AI suggestions extend any topic only when explicitly added, without starting a search", async ({ page }) => {
  let searches = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/search")) searches++; });
  await page.getByLabel("Keywords or hashtags").fill("cat adoption");
  await page.getByRole("button", { name: "Suggest more phrases with AI" }).click();
  await expect(page.getByText("Simulated suggestions — no AI inference", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("cat adoption");
  await page.getByRole("button", { name: "Add “cat adoption story”", exact: true }).click();
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("cat adoption, cat adoption story");
  expect(searches).toBe(0);
  await page.getByLabel("Keywords or hashtags").fill('"daughter arrived"');
  await expect(page.getByRole("button", { name: "Add “cat adoption story”", exact: true })).toHaveCount(0);
});

test("refining a legacy quoted alternative search shows plain phrases", async ({ page }) => {
  const params = new URLSearchParams({ query: '"daughter arrived", "baby arrived"', source: "fixtures" });
  await page.goto(`/search?${params}`);
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("daughter arrived, baby arrived");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Our daughter arrived yesterday.");
});

test("AI suggestion failures preserve keywords and leave manual search available", async ({ page }) => {
  await page.route("**/api/search/suggestions", (route) => route.fulfill({ status: 429,
    headers: { "Retry-After": "20" }, contentType: "application/json", body: JSON.stringify({ error: "Request limit reached." }) }));
  await page.getByLabel("Keywords or hashtags").fill("cat adoption");
  await page.getByRole("button", { name: "Suggest more phrases with AI" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Request limit" })).toContainText("20 seconds");
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("cat adoption");
  await expect(page.getByRole("button", { name: "Search posts", exact: true })).toBeEnabled();
});

test("empty results offer a refinement path preserving source and invalid syntax spends no search", async ({ page }) => {
  let calls = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/search")) calls++; });
  await page.getByLabel("Keywords or hashtags").fill("baby,,home");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "phrase" })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByLabel("Keywords or hashtags").fill("unmatchablephrase");
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page.getByRole("status")).toContainText("No matching posts");
  await page.getByRole("link", { name: "Refine search" }).click();
  await expect(page.getByLabel("Keywords or hashtags")).toHaveValue("unmatchablephrase");
  await expect(page.getByLabel("Source", { exact: true })).toHaveValue("fixtures");
});

test("saved Bluesky results repair previously encoded DID links", async ({ page, request }) => {
  const response = await request.post("http://127.0.0.1:54329/test/seed-live-link");
  const { searchId } = await response.json();
  await page.goto(`/searches/${searchId}`);
  await expect(page.getByRole("link", { name: "View original post" })).toHaveAttribute("href",
    "https://bsky.app/profile/did:plc:test/post/abc123");
});
