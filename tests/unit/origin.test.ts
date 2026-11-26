/** @jest-environment node */
import { hasSameOrigin } from "@/lib/security/origin";

test("checks browser host even when Next reconstructs an internal request URL", () => {
  expect(hasSameOrigin(new Request("http://localhost:3100/api/search", { headers: {
    Host: "127.0.0.1:3100", Origin: "http://127.0.0.1:3100",
  } }))).toBe(true);
});
test.each(["https://other.example", "null", "http://localhost:3101", "file:///", "not-a-url"])("rejects a mismatching or invalid origin", (origin) => {
  expect(hasSameOrigin(new Request("http://localhost:3100/api/search", { headers: { Origin: origin } }))).toBe(false);
});
test("does not trust a forged forwarded host", () => {
  expect(hasSameOrigin(new Request("http://localhost:3100/api/search", { headers: {
    Host: "localhost:3100", Origin: "https://other.example", "X-Forwarded-Host": "other.example",
  } }))).toBe(false);
});
test("rejects requests with no origin", () => {
  expect(hasSameOrigin(new Request("http://localhost:3100/api/search"))).toBe(false);
});
