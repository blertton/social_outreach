import { credentialsSchema, signupSchema } from "@/lib/auth/credentials";

test.each([
  { email: "not-email", password: "password" },
  { email: "reviewer@example.test", password: "" },
  { email: "reviewer@example.test", password: "x".repeat(1025) },
  { email: "reviewer@example.test", password: null },
])("rejects malformed or oversized credentials before dispatch", (input) => {
  expect(credentialsSchema.safeParse(input).success).toBe(false);
});
test("preserves exact password characters for authentication", () => {
  expect(credentialsSchema.parse({ email: "reviewer@example.test", password: " spaced password " }).password).toBe(" spaced password ");
});
test("requires eight characters for new accounts without imposing that on existing sign-ins", () => {
  const input = { email: "reviewer@example.test", password: "short" };
  expect(signupSchema.safeParse(input).success).toBe(false);
  expect(credentialsSchema.safeParse(input).success).toBe(true);
});
