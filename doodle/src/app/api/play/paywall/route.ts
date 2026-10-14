import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getCurrentUser } from "@/lib/auth/session";
import { getFreeRemaining, getTrialIdentity, isValidTrialToken } from "@/lib/generation/free-allowance";
import { getPaidBalance } from "@/lib/billing/credits";
import { readNativeJson, hasExactKeys } from "@/lib/native-contracts";
import { trackFunnel } from "@/lib/funnel-metrics";
export const dynamic="force-dynamic";
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});}
export async function POST(request:NextRequest){
 if(!hasSameOrigin(request))return json({error:"forbidden"},403);
 let body:Record<string,unknown>;
 try{body=await readNativeJson(request,256);}catch{return json({error:"invalid_request"},400);}
 if(!hasExactKeys(body,["trigger"])||!["tapped_create","get_more"].includes(String(body.trigger)))return json({error:"invalid_request"},400);
 try{
  const user=await getCurrentUser(request);
  const trialToken=request.headers.get("x-doodle-trial-token") ?? request.cookies.get("doodle_trial")?.value;
  const trial=trialToken&&isValidTrialToken(trialToken)?getTrialIdentity(request):null;
  if(!user&&!trial)return json({error:"unauthorized"},401);
  if(user&&await getPaidBalance(user.id)>0)return json({error:"credits_available"},409);
  if(trial&&await getFreeRemaining(trial)>0)return json({error:"credits_available"},409);
  trackFunnel({metric:"paywall_hit",actor:user?"account:"+user.id:"trial:"+trial!.id,email:user?.email,trigger:body.trigger as "tapped_create"|"get_more"});
  return json({accepted:true});
 }catch{return json({error:"metrics_unavailable"},503);}
}
