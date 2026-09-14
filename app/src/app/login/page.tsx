import { AuthForm } from "@/components/auth-form";
import { isConfigured, googleLoginEnabled } from "@/lib/supabase/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <AuthForm
      mode="login"
      configured={isConfigured()}
      googleEnabled={await googleLoginEnabled()}
      expired={(await searchParams).error === "expired"}
    />
  );
}
