import { hasSameOrigin } from "@/lib/auth/same-origin";
import { clearSessionCookie } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
