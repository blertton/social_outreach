import { expect, test } from "@playwright/test";

test("entry page, protected workspace and invalid sign-in behave safely", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(page).toHaveTitle("Social Outreach");
  await expect(page.getByRole("heading", { level: 1, name: "Social Outreach" })).toBeVisible();
  await expect(page.getByRole("region", { name: "The foundation is ready" })).toContainText(
    "Nothing is sent automatically.",
  );
  expect(browserErrors).toEqual([]);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  await page.goto("/search");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Email", { exact: true }).fill("new-reviewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto("/search");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("reviewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to sign in" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("sign-in persists across reload, refreshes the session and signs out", async ({ page, request }) => {
  const before = await (await request.get("http://127.0.0.1:54329/test/status")).json();
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/login-preview.png", fullPage: true });
  await page.getByLabel("Email", { exact: true }).fill("reviewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("heading", { name: "Your review workspace" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Signed in as reviewer@example.test")).toBeVisible();
  const after = await (await request.get("http://127.0.0.1:54329/test/status")).json();
  expect(after.refreshCount).toBeGreaterThan(before.refreshCount);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/search");
  await expect(page).toHaveURL(/\/login$/);
});
