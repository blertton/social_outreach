import { z } from "zod";
import { parseSearchQuery } from "./query";

export const searchInput = z.object({
  query: z.string().trim().min(1, "Enter a word or phrase to search for.").max(300, "Keep your search within 300 characters.").superRefine((query, ctx) => {
    try { parseSearchQuery(query); } catch {
      ctx.addIssue({ code: "custom", message: "Use up to four comma-separated phrases. Put matching quotes around a whole phrase." });
    }
  }),
  source: z.enum(["bluesky", "fixtures"]),
}).strict();
