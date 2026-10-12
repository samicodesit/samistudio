import { funnelDeletionLua } from "./funnel-deletion";
import { readFunnelWith } from "./funnel-report";
import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { redisCommand } from "./redis";
export type FunnelEvent = {actor:string;email?:string|null} & (
 {metric:"first_doodle"|"free_exhausted";knownFirstPaid?:boolean;knownFirstFree?:boolean} |
 {metric:"paywall_hit";trigger:"tapped_create"|"get_more"} |
 {metric:"purchase";id:string;pack:string;creditsGranted:number;offerApplied:boolean;isTest?:boolean}
);
const TTL=366*86400;
const PREFIX="doodle:metrics:funnel:";
const day = (date:Date) => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const qaEmail=(email?:string|null)=>["samicodesit@gmail.com","doodlereview889@gmail.com"].includes(email?.trim().toLowerCase()??"");
const RECORD=`
local actor=redis.call('GET', KEYS[1]) or ARGV[1]
if redis.call('EXISTS',ARGV[5]..'deleted:'..ARGV[1]) == 1 or redis.call('EXISTS',ARGV[5]..'deleted:'..actor) == 1 then return 0 end
-- Existing paid finalizations are retained functional history, not a new first drawing.
if ARGV[2] == 'first_doodle' and ARGV[9] ~= '1' and redis.call('HLEN', KEYS[4]) > 1 then return 0 end
if ARGV[6] == '1' or redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 or redis.call('SISMEMBER', KEYS[2], actor) == 1 or (ARGV[7] ~= '' and redis.call('SISMEMBER', KEYS[2], ARGV[7]) == 1) then return 0 end
local group=redis.call('SISMEMBER', KEYS[3], actor) == 1 and 'gifted' or 'regular'
local throttle=ARGV[5]..'limit:'..actor
if ARGV[2] == 'paywall_hit' then
 local requests=redis.call('INCR',throttle)
 if requests == 1 then redis.call('EXPIRE',throttle,60) end
 if requests > 20 then return 0 end
end
local identity=ARGV[5]..'identity:'..actor
local history=ARGV[5]..'history:'..actor
if ARGV[2] == 'first_doodle' or ARGV[2] == 'free_exhausted' then
 local prior=redis.call('HGET', identity, ARGV[2])
 -- Only an observed first free callback may replace its own historical exclusion.
 if prior and not (ARGV[2] == 'first_doodle' and ARGV[10] == '1' and prior == 'unobserved:'..ARGV[1]) then return 0 end
 redis.call('HSET', identity, ARGV[2], ARGV[3]); redis.call('EXPIRE', identity, ARGV[4])
end
local key=ARGV[5]..'day:'..ARGV[3]..':'..group..':'..ARGV[2]
local added=redis.call('SADD', key, actor)
redis.call('EXPIRE', key, ARGV[4])
redis.call('SADD', history, key); redis.call('EXPIRE', history, ARGV[4])
local start=ARGV[5]..'collection-start'
local prior=redis.call('GET',start)
if not prior or ARGV[3] < prior then redis.call('SET',start,ARGV[3]) end
redis.call('EXPIRE',start,ARGV[4])
if ARGV[8] ~= '' then
 local triggerKey=key..':'..ARGV[8]
 redis.call('SADD', triggerKey, actor); redis.call('EXPIRE', triggerKey, ARGV[4])
 redis.call('SADD', history, triggerKey)
end
return added
`;
const PURCHASE=`
if ARGV[5] == '1' or redis.call('SISMEMBER', KEYS[3], ARGV[4]) == 1 or (ARGV[6] ~= '' and redis.call('SISMEMBER', KEYS[3], ARGV[6]) == 1) then return 0 end
if redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[3]) == false then return 0 end
redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
redis.call('HINCRBY', KEYS[1], 'credits_granted', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
local prior=redis.call('GET',KEYS[4])
if not prior or ARGV[7] < prior then redis.call('SET',KEYS[4],ARGV[7]) end
redis.call('EXPIRE',KEYS[4],ARGV[3])
return 1
`;
export async function recordFunnel(event:FunnelEvent,at=new Date()):Promise<void>{
 try {
  const email=event.email?.trim().toLowerCase();
  const emailKey=email?"email:"+hash(email):"";
  const actor=hash(event.actor);
  if (event.metric==="purchase") {
   const allowed=event.pack==="doodle_credits_10"?[10]:event.pack==="pack_mini"?[6]:event.pack==="pack_regular"?[20,25]:event.pack==="pack_big"?[60]:[];
   if (!allowed.includes(event.creditsGranted) || event.isTest) return;
   await redisCommand(["EVAL",PURCHASE,"4",PREFIX+"purchases:"+day(at),PREFIX+"receipt:"+hash(event.id),"doodle:metrics:qa",PREFIX+"collection-start",event.pack+":"+event.creditsGranted+":"+(event.offerApplied?"bonus":"standard"),event.creditsGranted,TTL,actor,qaEmail(email)?"1":"0",emailKey,day(at)],AbortSignal.timeout(1500));
  } else {
   const accountId = /^account:([0-9a-f-]{36})$/i.exec(event.actor)?.[1];
   const paidHistory = accountId ? "doodle:account:"+accountId+":finalized" : PREFIX+"no-paid-history";
   await redisCommand(["EVAL",RECORD,"4",PREFIX+"alias:"+actor,"doodle:metrics:qa","doodle:metrics:gifted",paidHistory,actor,event.metric,day(at),TTL,PREFIX,qaEmail(email)?"1":"0",emailKey,event.metric==="paywall_hit"?event.trigger:"",event.metric==="first_doodle" && event.knownFirstPaid ? "1" : "0",event.metric==="first_doodle" && event.knownFirstFree ? "1" : "0"],AbortSignal.timeout(1500));
  }
 } catch {console.warn("[doodle-metrics] funnel unavailable");}
}
export function trackFunnel(event:FunnelEvent):void{
 if(process.env.VERCEL_ENV!=="production")return;
 try{const at=new Date();after(()=>recordFunnel(event,at));}catch{console.warn("[doodle-metrics] funnel scheduling unavailable");}
}
const MERGE=`
if redis.call('EXISTS',ARGV[4]..'deleted:'..ARGV[1]) == 1 or redis.call('EXISTS',ARGV[4]..'deleted:'..ARGV[2]) == 1 then return 0 end
local prior=redis.call('GET', KEYS[1])
if prior and prior ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('SADD', KEYS[2], ARGV[1]);redis.call('EXPIRE', KEYS[2], ARGV[3])
if ARGV[5] == '1' then redis.call('SADD', KEYS[3], ARGV[1], ARGV[2]) end
local source=ARGV[4]..'identity:'..ARGV[1]
local target=ARGV[4]..'identity:'..ARGV[2]
local sourceHistory=ARGV[4]..'history:'..ARGV[1]
local targetHistory=ARGV[4]..'history:'..ARGV[2]
local excluded=redis.call('SISMEMBER', KEYS[3], ARGV[2]) == 1 or (ARGV[6] ~= '' and redis.call('SISMEMBER', KEYS[3], ARGV[6]) == 1)
local group=redis.call('SISMEMBER', KEYS[4], ARGV[2]) == 1 and 'gifted' or 'regular'
-- Retained trial usage proves a first drawing already happened, without inventing an event.
if tonumber(redis.call('GET',KEYS[5]) or '0') > 0 and redis.call('HEXISTS',source,'first_doodle') == 0 then
 redis.call('HSET',source,'first_doodle','unobserved:'..ARGV[1])
end
-- An older paid ledger also proves prior activity before a fresh guest alias.
if redis.call('HLEN',KEYS[6]) > 0 and redis.call('HEXISTS',KEYS[6],'__first_doodle__') == 0 and redis.call('HEXISTS',target,'first_doodle') == 0 then
 redis.call('HSET',target,'first_doodle','unobserved:'..ARGV[2])
end
local metrics={'first_doodle','free_exhausted'}
for _,metric in ipairs(metrics) do
 local a=redis.call('HGET',source,metric)
 local b=redis.call('HGET',target,metric)
 local aUnknown=a and string.sub(a,1,11) == 'unobserved:'
 local bUnknown=b and string.sub(b,1,11) == 'unobserved:'
 if a and (not b or (aUnknown and not bUnknown) or (not aUnknown and not bUnknown and a < b)) then
  if b then
   redis.call('SREM',ARGV[4]..'day:'..b..':regular:'..metric,ARGV[2])
   redis.call('SREM',ARGV[4]..'day:'..b..':gifted:'..metric,ARGV[2])
  end
  redis.call('HSET',target,metric,a)
 end
end
for _,key in ipairs(redis.call('SMEMBERS',sourceHistory)) do
 redis.call('SREM',key,ARGV[1])
 local date=string.match(key,':day:(%d%d%d%d%-%d%d%-%d%d):')
 local metric=string.match(key,':([^:]+)$')
 local once=metric == 'first_doodle' or metric == 'free_exhausted'
 if not excluded and (not once or redis.call('HGET',target,metric) == date) then
  local moved=string.gsub(string.gsub(key,':regular:',':'..group..':'),':gifted:',':'..group..':')
  redis.call('SADD',moved,ARGV[2]);redis.call('SADD',targetHistory,moved)
  redis.call('EXPIRE',moved,ARGV[3])
 end
end
if excluded then
 for _,key in ipairs(redis.call('SMEMBERS',targetHistory)) do redis.call('SREM',key,ARGV[2]) end
end
redis.call('EXPIRE',target,ARGV[3]);redis.call('EXPIRE',targetHistory,ARGV[3])
redis.call('DEL',source,sourceHistory)
return 1
`;
export async function mergeFunnelIdentity(trialActor:string,accountActor:string,email?:string){
 try{
  const trialId=/^trial:([0-9a-f-]{36})$/i.exec(trialActor)?.[1];
  const trialUsage=trialId?"doodle:trial:used:"+trialId:PREFIX+"no-trial-history";
  const accountId=/^account:([0-9a-f-]{36})$/i.exec(accountActor)?.[1];
  const paidHistory=accountId?"doodle:account:"+accountId+":finalized":PREFIX+"no-paid-history";
  await redisCommand(["EVAL",MERGE,"6",PREFIX+"alias:"+hash(trialActor),PREFIX+"aliases:"+hash(accountActor),"doodle:metrics:qa","doodle:metrics:gifted",trialUsage,paidHistory,hash(trialActor),hash(accountActor),TTL,PREFIX,qaEmail(email)?"1":"0",email?"email:"+hash(email.trim().toLowerCase()):""],AbortSignal.timeout(1500));
 }catch{console.warn("[doodle-metrics] funnel merge unavailable");}
}
export async function deleteFunnelIdentity(actor:string){
 const identity=hash(actor);
 const script=funnelDeletionLua("ARGV[1]", "KEYS[1]", "ARGV[2]")+"return 1";
 await redisCommand(["EVAL",script,"1",PREFIX+"aliases:"+identity,identity,PREFIX],AbortSignal.timeout(1500));
}
export function readFunnel(days:string[]){return readFunnelWith(redisCommand,days);}
