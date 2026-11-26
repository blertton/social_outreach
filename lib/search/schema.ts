import { z } from "zod";

export const searchInput = z.object({
  query: z.string().trim().min(1).max(300),
  source: z.enum(["bluesky", "fixtures"]),
}).strict();
