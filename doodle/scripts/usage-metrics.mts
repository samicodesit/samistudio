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
const fields = ["drawings:android", "drawings:web", "purchases:android", "purchases:web"];
const rows = [];
for (let offset = days - 1; offset >= 0; offset--) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - offset);
  const day = date.toISOString().slice(0, 10);
  const response = await fetch(url, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["HMGET", `doodle:metrics:day:${day}`, ...fields]), signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !Array.isArray(payload.result) || payload.result.length !== 4) {
    throw new Error("Metrics read unavailable. No zero counts inferred.");
  }
  const counts = payload.result.map((value: unknown) => value === null ? 0 : Number(value));
  if (counts.some((value: number) => !Number.isSafeInteger(value) || value < 0)) throw new Error("Invalid metrics response");
  rows.push({ date: day, androidDrawings: counts[0], webDrawings: counts[1], androidPurchases: counts[2], webPurchases: counts[3] });
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), timezone, measure: "Observed successful drawings and newly fulfilled non-test paid packs", daily: rows }, null, 2));
