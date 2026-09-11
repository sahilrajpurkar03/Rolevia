import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeAuthCallback } from "@/lib/auth-callback";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const client = await createClient();
      const result = await exchangeAuthCallback(
        client,
        request.nextUrl.searchParams,
      );
      if (result) {
        if (result.recovery)
          (await cookies()).set("rolevia-recovery", result.userId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600,
          });
        return NextResponse.redirect(
          new URL(
            result.recovery ? "/reset-password" : "/workspace",
            request.url,
          ),
        );
      }
    } catch {}
  }
  return NextResponse.redirect(new URL("/login?error=expired", request.url));
}
