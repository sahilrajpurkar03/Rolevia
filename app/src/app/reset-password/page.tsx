import { cookies } from "next/headers";
import { AuthForm } from "@/components/auth-form";
import { createClient, isConfigured } from "@/lib/supabase/server";
export default async function Page() {
  if (!isConfigured()) return <AuthForm mode="reset" configured={false} />;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const valid =
    user && (await cookies()).get("rolevia-recovery")?.value === user.id;
  return <AuthForm mode="reset" configured={Boolean(valid)} expired={!valid} />;
}
