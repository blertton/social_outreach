import { expect, test } from "@playwright/test";

test("the entry page loads without browser errors and explains its status", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(page).toHaveTitle("Social Outreach");
  await expect(page.getByRole("heading", { level: 1, name: "Social Outreach" })).toBeVisible();
  await expect(page.getByRole("region", { name: "The foundation is ready" })).toContainText(
    "Nothing is sent automatically.",
  );
  expect(browserErrors).toEqual([]);
});
