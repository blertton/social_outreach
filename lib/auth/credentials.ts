import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
});

export const signupSchema = credentialsSchema.extend({ password: z.string().min(8).max(1024) });
