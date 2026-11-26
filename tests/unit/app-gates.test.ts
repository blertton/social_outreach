jest.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { draftMode } from "@/lib/ai/eligibility";
import { withUsageGate, withDraftGate } from "@/lib/security/gates";

const complete = { status: "complete", relevance: "relevant", sensitivity: "none" };
const allowed = [{ allowed: true, remaining: 99, retry_after_seconds: 0 }];

function session() {
  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  const rpc = jest.fn().mockResolvedValue({ data: allowed, error: null });
  return { getUser, rpc, client: { auth: { getUser }, rpc } as unknown as SupabaseClient };
}

test.each([null, {}, { ...complete, status: "failed" }, { ...complete, relevance: "uncertain" },
  { ...complete, relevance: "irrelevant" }, { ...complete, sensitivity: "other" }, { ...complete, sensitivity: "uncertain" }])(
  "blocks missing, failed, uncertain and inappropriate analysis", (analysis) => expect(draftMode(analysis)).toBe("blocked"),
);
test("selects standard or condolence without allowing other sensitive content", () => {
  expect(draftMode(complete)).toBe("standard");
  expect(draftMode({ ...complete, sensitivity: "bereavement" })).toBe("condolence");
});
test("denies signed-out calls before quota reservation or external work", async () => {
  const s = session(); s.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const work = jest.fn();
  await expect(withUsageGate(s.client, "ai", work)).rejects.toMatchObject({ status: 401 });
  expect(s.rpc).not.toHaveBeenCalled(); expect(work).not.toHaveBeenCalled();
});
test("reserves quota before external work", async () => {
  const s = session();
  const work = jest.fn(async (id) => { expect(s.rpc).toHaveBeenCalledWith("reserve_usage", { p_action: "search" }); return id; });
  await expect(withUsageGate(s.client, "search", work)).resolves.toBe("owner");
});
test("exhausted quota returns retry information without external work", async () => {
  const s = session(); s.rpc.mockResolvedValue({ data: [{ allowed: false, remaining: 0, retry_after_seconds: 31 }], error: null });
  const work = jest.fn();
  await expect(withUsageGate(s.client, "ai", work)).rejects.toMatchObject({ status: 429, retryAfterSeconds: 31 });
  expect(work).not.toHaveBeenCalled();
});
test.each([{ data: null, error: { message: "private db detail" } }, { data: [], error: null },
  { data: [{ allowed: true }], error: null }])("fails closed on quota errors/invalid output", async (response) => {
  const s = session(); s.rpc.mockResolvedValue(response); const work = jest.fn();
  await expect(withUsageGate(s.client, "ai", work)).rejects.toMatchObject({ status: 503 });
  expect(work).not.toHaveBeenCalled();
});
test.each([null, { userId: "someone-else", analysis: complete }, { userId: "owner", analysis: { ...complete, sensitivity: "other" } }])(
  "rejects unavailable, foreign and blocked draft results before spending", async (result) => {
    const s = session(); const generate = jest.fn();
    await expect(withDraftGate(s.client, async () => result, generate)).rejects.toMatchObject({ status: 403 });
    expect(s.rpc).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
  },
);
test("bereavement only reaches the condolence generator after reservation", async () => {
  const s = session(); const generate = jest.fn().mockResolvedValue("condolence");
  await withDraftGate(s.client, async () => ({ userId: "owner", analysis: { ...complete, sensitivity: "bereavement" } }), generate);
  expect(s.rpc).toHaveBeenCalledWith("reserve_usage", { p_action: "ai" });
  expect(generate).toHaveBeenCalledWith("condolence");
});
test("each attempt consumes allowance even when external work fails", async () => {
  const s = session(); const work = jest.fn().mockRejectedValue(new Error("provider unavailable"));
  await expect(withUsageGate(s.client, "ai", work)).rejects.toThrow("provider unavailable");
  await expect(withUsageGate(s.client, "ai", work)).rejects.toThrow();
  expect(s.rpc).toHaveBeenCalledTimes(2);
});
