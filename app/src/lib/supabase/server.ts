import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
export async function createClient() {
  if (!isConfigured())
    throw new Error("Supabase is not configured. Follow the setup guide.");
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
export async function requireUser() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Please sign in again.");
  return { client, user };
}
