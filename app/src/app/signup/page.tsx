import { AuthForm } from "@/components/auth-form";
import { isConfigured, googleLoginEnabled } from "@/lib/supabase/server";
export default async function Page() {
  return <AuthForm mode="signup" configured={isConfigured()} googleEnabled={await googleLoginEnabled()} />;
}
