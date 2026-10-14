import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { hasExactKeys, readNativeJson } from "@/lib/native-contracts";
import { getPlayBillingConfig, playAccountId } from "@/lib/billing/play-config";
import { PLAY_PACK_IDS, type PlayPackId } from "@/lib/billing/play-catalog";
import { createPlayIntent } from "@/lib/billing/play-intents";
export const dynamic="force-dynamic";
export const runtime="nodejs";
function json(body: unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});}
export async function POST(request: Request) {
 if (!hasSameOrigin(request)) return json({error:"forbidden"},403);
 const user=await getCurrentUser(request).catch(()=>null);
 if (!user) return json({error:"unauthorized"},401);
 let body: Record<string,unknown>;
 try {body=await readNativeJson(request,1024);} catch {return json({error:"invalid_request"},400);}
 if (!hasExactKeys(body,["productId","expectedCredits"]) || !PLAY_PACK_IDS.includes(body.productId as PlayPackId) || !Number.isSafeInteger(body.expectedCredits)) return json({error:"invalid_request"},400);
 try {
  if (!getPlayBillingConfig()) return json({error:"play_unavailable"},503);
  const intent=await createPlayIntent(user.id,body.productId as PlayPackId,body.expectedCredits as number);
  return json({...intent,obfuscatedAccountId:playAccountId(user.id)});
 } catch(error) {
  const message=error instanceof Error?error.message:"";
  return json({error:message==="offer_changed"?"offer_changed":message==="rate_limited"?"rate_limited":"play_unavailable"},message==="offer_changed"?409:message==="rate_limited"?429:503);
 }
}
