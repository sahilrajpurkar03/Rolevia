import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const recovery = request.nextUrl.searchParams.get("next") === "reset";
  if (code) {
    try {
      const client = await createClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        if (recovery)
          (await cookies()).set("rolevia-recovery", data.user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600,
          });
        return NextResponse.redirect(
          new URL(recovery ? "/reset-password" : "/workspace", request.url),
        );
      }
    } catch {}
  }
  return NextResponse.redirect(new URL("/login?error=expired", request.url));
}
