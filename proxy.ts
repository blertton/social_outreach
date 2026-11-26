import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/db/config";
import type { Database } from "@/lib/db/database.types";

export async function proxy(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    const { data, error } = await client.auth.getUser();
    if ((error || !data.user) && request.nextUrl.pathname.startsWith("/search")) {
      const target = request.nextUrl.clone();
      target.pathname = "/login"; target.search = "";
      const redirect = NextResponse.redirect(target);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    }
  } catch {
    return new NextResponse("Sign-in is temporarily unavailable. Try again shortly.", {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/login", "/signup", "/search/:path*", "/searches/:path*"] };
