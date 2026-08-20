import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

export interface AuthorizationResult {
  authorized: boolean;
  subject: "private-owner" | null;
}

export async function authorizeGeneration(request: NextRequest): Promise<AuthorizationResult> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.SESSION_SECRET;

  if (!token || !secret || !verifySessionToken(token, secret)) {
    return { authorized: false, subject: null };
  }

  return { authorized: true, subject: "private-owner" };
}
