import { readFunnelWith } from "../src/lib/funnel-report";
import "dotenv/config";

const days = Number(process.argv[2] ?? 7);
if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("Use 1 to 90 days: npm run metrics -- 7");
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error("Missing existing Redis configuration");
const timezone = "Europe/Amsterdam";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const fields = ["drawings:android", "drawings:web", "purchases:android", "purchases:web", "gifted_drawings:android", "gifted_drawings:web"];
const outcomes = ["success", "refused", "timeout", "error", "service_unavailable", "rate_limited", "credits_exhausted"];
const buckets = ["under_10s", "10_to_30s", "30_to_60s", "60_to_120s", "120s_plus"];
const regularOperationFields = [...["android", "web"].flatMap(channel => outcomes.flatMap(outcome => {
  const prefix = `generation:${channel}:${outcome}`;
  return [prefix, `${prefix}:duration_count`, `${prefix}:duration_ms`, ...buckets.map(bucket => `${prefix}:${bucket}`)];
})), "checkout:web:created", "checkout:web:error", "wallet_setup:web:created", "wallet_setup:web:error"];
const operationFields = ["collection_version", ...regularOperationFields, ...regularOperationFields.map(field => `gifted:${field}`)];

async function readCounts(key: string, names: string[]) {
  const response = await fetch(url!, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["HMGET", key, ...names]), signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !Array.isArray(payload.result) || payload.result.length !== names.length) {
    throw new Error("Metrics read unavailable. No zero counts inferred.");
  }
  const counts = payload.result.map((value: unknown) => value === null ? 0 : Number(value));
  if (counts.some((value: number) => !Number.isSafeInteger(value) || value < 0)) throw new Error("Invalid metrics response");
  return Object.fromEntries(names.map((name, index) => [name, counts[index]])) as Record<string, number>;
}

function generationSummary(counts: Record<string, number>, channel: string, audience = "") {
  return Object.fromEntries(outcomes.map(outcome => {
    const prefix = `${audience}generation:${channel}:${outcome}`;
    const timed = counts[`${prefix}:duration_count`];
    return [outcome, {
      requests: counts[prefix],
      timedResponses: timed,
      meanServerSeconds: timed ? Math.round(counts[`${prefix}:duration_ms`] / timed / 100) / 10 : null,
      durationBuckets: Object.fromEntries(buckets.map(bucket => [bucket, counts[`${prefix}:${bucket}`]])),
    }];
  }));
}
const rows = [];
for (let offset = days - 1; offset >= 0; offset--) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - offset);
  const day = date.toISOString().slice(0, 10);
  const [counts, operations] = await Promise.all([
    readCounts(`doodle:metrics:day:${day}`, fields),
    readCounts(`doodle:metrics:operations:day:${day}`, operationFields),
  ]);
  if (operations.collection_version !== 0 && operations.collection_version !== 1) throw new Error("Unsupported operational metrics version");
  rows.push({
    date: day, androidDrawings: counts[fields[0]], webDrawings: counts[fields[1]], androidPurchases: counts[fields[2]], webPurchases: counts[fields[3]],
    giftedAndroidDrawings: counts[fields[4]], giftedWebDrawings: counts[fields[5]],
    operations: operations.collection_version === 1 ? {
      generation: { android: generationSummary(operations, "android"), web: generationSummary(operations, "web") },
      webCheckout: { sessionsCreated: operations["checkout:web:created"], errors: operations["checkout:web:error"] },
      webWalletSetup: { sessionsCreated: operations["wallet_setup:web:created"], errors: operations["wallet_setup:web:error"] },
      gifted: {
        generation: { android: generationSummary(operations, "android", "gifted:"), web: generationSummary(operations, "web", "gifted:") },
        webCheckout: { sessionsCreated: operations["gifted:checkout:web:created"], errors: operations["gifted:checkout:web:error"] },
        webWalletSetup: { sessionsCreated: operations["gifted:wallet_setup:web:created"], errors: operations["gifted:wallet_setup:web:error"] },
      },
    } : null,
  });
}
const funnel=await readFunnelWith(async(command)=>{
 const response=await fetch(url!,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});
 const data=await response.json();
 if(!response.ok||data.error)throw new Error("Funnel read unavailable. No zero counts inferred.");
 return data.result;
},rows.map(row=>row.date));
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(), timezone,
  androidFunnel: funnel,
  attribution: "Install sources are reported separately from Play Console completed acquisitions. Purchases have no channel attribution.",
  measure: "Observed successful drawings, newly fulfilled non-test paid packs and backend request outcomes",
  operationalNotes: "Request counts, not unique people. Gifted accounts' drawings and request outcomes are reported separately from regular usage, including their failures and timings. Complimentary credit grants are not purchases; a later real payment still counts. Server durations omit client/network time. Wallet setup is not a purchase click. Null operations means no operational observations recorded for that day; no historical backfill. Best-effort collection can miss events.",
  daily: rows,
}, null, 2));
