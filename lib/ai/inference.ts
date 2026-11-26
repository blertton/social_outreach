import "server-only";
import { z } from "zod";

export function inferenceConfig() {
  const provider = process.env.AI_PROVIDER ?? "openrouter";
  const model = provider === "mock" ? "mock/synthetic-v1" : process.env.OPENROUTER_MODEL?.trim();
  if (!model || model.length > 200 || !["mock", "openrouter"].includes(provider)) throw new Error("AI configuration is unavailable.");
  return { provider, model };
}

const envelopeSchema = z.object({
  error: z.unknown().optional(),
  choices: z.array(z.object({ finish_reason: z.literal("stop"), message: z.object({ content: z.string().max(12_000) }) })).length(1),
});

async function readBoundedResponse(response: Response) {
  if (!response.ok || !response.body) throw new Error();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 65_536) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function inferStructured<S extends z.ZodType>({ schema, name, system, input, maxTokens }: {
  schema: S; name: string; system: string; input: unknown; maxTokens: number;
}): Promise<z.output<S>> {
  try {
    const { provider, model } = inferenceConfig();
    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (provider !== "openrouter" || !key || key.startsWith("your-")) throw new Error();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0.2, reasoning: { enabled: false }, max_tokens: maxTokens,
        provider: { require_parameters: true, data_collection: "deny" },
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema: z.toJSONSchema(schema) } },
        messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(input) }],
      }),
    });
    const envelope = envelopeSchema.parse(await readBoundedResponse(response));
    if (envelope.error) throw new Error();
    return schema.parse(JSON.parse(envelope.choices[0].message.content));
  } catch {
    throw new Error("AI request could not be completed.");
  }
}
