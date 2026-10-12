const PREFIX = "doodle:metrics:funnel:";
const METRICS = ["first_doodle", "free_exhausted", "paywall_hit", "paywall_hit:tapped_create", "paywall_hit:get_more"];
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export async function readFunnelWith(redisCommand: (command: unknown[]) => Promise<unknown>, dates: string[]) {
  if (dates.length < 1 || dates.length > 90 || dates.some(value => !validDate(value))) throw new Error("Invalid report dates");
  const days = [...new Set(dates)].sort();
  const start = await redisCommand(["GET", PREFIX + "collection-start"]);
  if (start !== null && (typeof start !== "string" || !validDate(start))) throw new Error("Funnel read unavailable");
  const observedDays = start === null ? [] : days.filter(date => date >= start);
  const unobservedDates = days.filter(date => !observedDays.includes(date));
  const result = {
    coverage: {
      status: observedDays.length === 0 ? "unobserved" : unobservedDates.length ? "partial" : "observed",
      observedFrom: start as string | null,
      unobservedDates,
      note: "Counts cover dates since the first retained funnel observation. Collection is best effort and can miss events. No historical backfill.",
    },
    regular: {} as Record<string, number | null>,
    gifted: {} as Record<string, number | null>,
    purchases: null as Record<string, number> | null,
    creditsGranted: null as number | null,
  };
  for (const group of ["regular", "gifted"] as const) {
    for (const metric of METRICS) {
      if (!observedDays.length) { result[group][metric] = null; continue; }
      const keys = observedDays.map(date => PREFIX + "day:" + date + ":" + group + ":" + metric);
      const raw = await redisCommand(["EVAL", "return #redis.call('SUNION',unpack(KEYS))", keys.length, ...keys]);
      const value = Number(raw);
      if (raw === null || !Number.isSafeInteger(value) || value < 0) throw new Error("Funnel read unavailable");
      result[group][metric] = value;
    }
  }
  if (!observedDays.length) return result;
  result.purchases = {};
  result.creditsGranted = 0;
  for (const date of observedDays) {
    const fields = await redisCommand(["EVAL", "return redis.call('HGETALL',KEYS[1])", "1", PREFIX + "purchases:" + date]);
    if (!Array.isArray(fields) || fields.length % 2) throw new Error("Funnel read unavailable");
    for (let i = 0; i < fields.length; i += 2) {
      const key = String(fields[i]); const n = Number(fields[i + 1]);
      if (fields[i + 1] === null || !Number.isSafeInteger(n) || n < 0) throw new Error("Funnel read unavailable");
      if (key === "credits_granted") result.creditsGranted += n;
      else result.purchases[key] = (result.purchases[key] ?? 0) + n;
    }
  }
  return result;
}
