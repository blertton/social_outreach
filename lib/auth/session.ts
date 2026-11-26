import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

export async function requireReviewer() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { client, user: data.user };
}
