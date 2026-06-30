import { assertBrowserSafeSupabaseKey } from "@/lib/supabase/anon-key";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  if (oauthError) {
    console.error("[auth/callback] OAuth error:", oauthError, oauthErrorDescription);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (code) {
    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      try {
        assertBrowserSafeSupabaseKey(key, "auth/callback");
      } catch (err) {
        console.error("[auth/callback] chave Supabase inválida:", err);
        return NextResponse.redirect(`${origin}/login?error=auth`);
      }
      const supabase = createServerClient(url, key, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error("[auth/callback] exchangeCodeForSession:", error.message, error);
    } else {
      console.error("[auth/callback] NEXT_PUBLIC_SUPABASE_URL ou ANON_KEY ausentes");
    }
  } else {
    console.error("[auth/callback] callback sem code na query string");
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
