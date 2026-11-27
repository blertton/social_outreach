import { expect, test, type Page } from "@playwright/test";

const origin = { Origin: "http://127.0.0.1:3100" };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("reviewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
}

async function analyzedSample(page: Page, query: string) {
  await signIn(page);
  await page.getByLabel("Keywords or hashtags").fill(query);
  await page.getByLabel("Source", { exact: true }).selectOption("fixtures");
  await page.getByRole("button", { name: "Search posts" }).click();
  await expect(page).toHaveURL(/\/searches\/[a-f0-9-]+$/);
  const card = page.getByRole("article").first();
  await card.getByRole("button", { name: "Analyze post", exact: true }).click();
  return card;
}

test("a standard reply is generated on request, edited, approved and restored after reload", async ({ page }) => {
  let drafts = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/drafts") && r.method() === "POST") drafts++; });
  const card = await analyzedSample(page, "daughter");
  await expect(card.getByText("Standard reply allowed", { exact: true })).toBeVisible();
  expect(drafts).toBe(0);

  await card.getByRole("button", { name: "Generate reply", exact: true }).click();
  const editor = card.getByLabel("Reply draft", { exact: true });
  await expect(editor).toHaveValue(/Simulated reply/);
  await expect(card.getByText("Simulated draft — no AI inference", { exact: true })).toBeVisible();
  await expect(card.getByText("Status: Draft", { exact: true })).toBeVisible();
  expect(drafts).toBe(1);

  await editor.fill("Congratulations on your daughter's arrival. Wishing you all some rest.");
  await expect(card.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(card.getByText("Status: Approved", { exact: true })).toBeVisible();
  await expect(card.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Copy reply", exact: true })).toBeVisible();

  await page.reload();
  const reloaded = page.getByRole("article").first();
  await expect(reloaded.getByLabel("Reply draft", { exact: true })).toHaveValue("Congratulations on your daughter's arrival. Wishing you all some rest.");
  await expect(reloaded.getByText("Status: Approved", { exact: true })).toBeVisible();

  // Editing reviewed text and saving it without a new decision clears the approval.
  await reloaded.getByLabel("Reply draft", { exact: true }).fill("Congratulations on your daughter's arrival.");
  await expect(reloaded.getByRole("button", { name: "Copy reply", exact: true })).toHaveCount(0);
  await reloaded.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(reloaded.getByText("Status: Draft", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article").first().getByText("Status: Draft", { exact: true })).toBeVisible();
  expect(drafts).toBe(1);
});

test("rejection persists and regenerating asks before replacing edited text", async ({ page }) => {
  const card = await analyzedSample(page, "bakery");
  await card.getByRole("button", { name: "Generate reply", exact: true }).click();
  const editor = card.getByLabel("Reply draft", { exact: true });
  await expect(editor).toHaveValue(/Simulated reply/);
  await card.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(card.getByText("Status: Rejected", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article").first().getByText("Status: Rejected", { exact: true })).toBeVisible();

  const reloaded = page.getByRole("article").first();
  await reloaded.getByLabel("Reply draft", { exact: true }).fill("My own edited reply.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await reloaded.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(reloaded.getByLabel("Reply draft", { exact: true })).toHaveValue("My own edited reply.");

  page.once("dialog", (dialog) => dialog.accept());
  await reloaded.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(reloaded.getByLabel("Reply draft", { exact: true })).toHaveValue(/Simulated reply/);
  await expect(reloaded.getByText("Status: Draft", { exact: true })).toBeVisible();
});

test("bereavement offers only a noncommercial condolence draft", async ({ page }) => {
  const card = await analyzedSample(page, "grief");
  await expect(card.getByText("Condolence only — no commercial outreach", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Generate reply", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "Generate condolence message", exact: true }).click();
  const editor = card.getByLabel("Condolence draft", { exact: true });
  await expect(editor).toHaveValue(/Simulated condolence/);
  await expect(editor).not.toHaveValue(/insurance|Amanet|policy|cover/i);
});

test("uncertain and irrelevant posts have no reply controls and the server refuses them", async ({ page, request }) => {
  await signIn(page);
  const { searchId } = await (await request.post("http://127.0.0.1:54329/test/seed-analysis-order")).json();
  await page.goto(`/searches/${searchId}`);
  const uncertain = page.getByRole("article").filter({ hasText: "Something changed." });
  await expect(uncertain.getByText("Reply drafting blocked", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /generate/i })).toHaveCount(1);
  const resultId = await uncertain.getAttribute("data-result-id");
  expect(resultId).toMatch(/^[a-f0-9-]{36}$/);
  const refused = await page.request.post("/api/drafts", { data: { resultId }, headers: origin });
  expect(refused.status()).toBe(403);
});

test("generation failure keeps the analysis and allows a retry", async ({ page }) => {
  const card = await analyzedSample(page, "daughter");
  await page.route("**/api/drafts", (route) => route.fulfill({ status: 503, contentType: "application/json",
    body: JSON.stringify({ error: "A reply could not be generated. Please retry." }) }), { times: 1 });
  await card.getByRole("button", { name: "Generate reply", exact: true }).click();
  await expect(card.getByRole("alert")).toHaveText("A reply could not be generated. Please retry.");
  await expect(card.getByText("Standard reply allowed", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Generate reply", exact: true }).click();
  await expect(card.getByLabel("Reply draft", { exact: true })).toHaveValue(/Simulated reply/);
});

test("draft APIs reject signed-out, cross-origin and forged requests", async ({ request }) => {
  const resultId = "00000000-0000-4000-8000-000000000099";
  expect((await request.post("/api/drafts", { data: { resultId }, headers: origin })).status()).toBe(401);
  expect((await request.post("/api/drafts", { data: { resultId }, headers: { Origin: "https://other.example" } })).status()).toBe(403);
  expect((await request.post("/api/drafts", { data: { resultId, mode: "standard", text: "forged" }, headers: origin })).status()).toBe(400);
  expect((await request.patch(`/api/drafts/${resultId}`, { data: { text: "x", status: "approved" }, headers: origin })).status()).toBe(401);
  expect((await request.patch(`/api/drafts/${resultId}`, { data: { text: "x", status: "published" }, headers: origin })).status()).toBe(400);
});
