import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { draftMode } from "@/lib/ai/eligibility";

const quotaSchema = z.array(z.object({
  allowed: z.boolean(),
  remaining: z.number().int().nonnegative(),
  retry_after_seconds: z.number().int().nonnegative(),
})).length(1);

export class GateError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 413 | 429 | 503,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) { super(message); }
}

export async function requireUser(client: SupabaseClient) {
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new GateError(401, "Sign in to continue.");
    return data.user.id;
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError(503, "Authentication is temporarily unavailable.");
  }
}

export async function reserveUsage(client: SupabaseClient, action: "search" | "ai") {
  try {
    const { data, error } = await client.rpc("reserve_usage", { p_action: action });
    const result = quotaSchema.safeParse(data);
    if (error || !result.success) throw new GateError(503, "Usage checks are temporarily unavailable.");
    const quota = result.data[0];
    if (!quota.allowed) throw new GateError(429, "Request limit reached. Try again later.", Math.max(1, quota.retry_after_seconds));
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError(503, "Usage checks are temporarily unavailable.");
  }
}

// Search/analysis routes validate inputs first and perform external work
// only inside this callback. Every retry needs its own reservation.
export async function withUsageGate<T>(
  client: SupabaseClient,
  action: "search" | "ai",
  operation: (userId: string) => Promise<T>,
) {
  const userId = await requireUser(client);
  await reserveUsage(client, action);
  return operation(userId);
}

// The loader must read a result and analysis from the DB under session RLS.
// No request body is allowed to supply its owner or eligibility analysis.
export async function withDraftGate<T>(
  client: SupabaseClient,
  loadResult: (userId: string) => Promise<{ userId: string; analysis: unknown } | null>,
  generate: (mode: "standard" | "condolence") => Promise<T>,
) {
  const userId = await requireUser(client);
  const result = await loadResult(userId);
  if (!result || result.userId !== userId) throw new GateError(403, "This result is unavailable.");
  const mode = draftMode(result.analysis);
  if (mode === "blocked") throw new GateError(403, "A reply cannot be generated for this result.");
  await reserveUsage(client, "ai");
  return generate(mode);
}
