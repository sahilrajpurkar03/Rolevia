import { AuthForm } from "@/components/auth-form";
import { isConfigured } from "@/lib/supabase/server";
export default function Page() {
  return <AuthForm mode="signup" configured={isConfigured()} />;
}
