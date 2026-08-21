import { hasLocale, localePath } from "@/lib/i18n";
import { createServerSupabase } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const locale = requestedLocale && hasLocale(requestedLocale) ? requestedLocale : "en";
  const { error } = code
    ? await (await createServerSupabase()).auth.exchangeCodeForSession(code)
    : { error: new Error("missing code") };

  return NextResponse.redirect(new URL(`${localePath(locale)}?auth=${error ? "error" : "success"}`, request.url));
}
