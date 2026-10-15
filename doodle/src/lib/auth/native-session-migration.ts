import "server-only";
import { redisCommand } from "@/lib/redis";
import { indexStoredNativeSession } from "@/lib/native-session";

export async function migrateNativeSessionIndex(applied = false) {
  const result = { scanned: 0, indexed: 0, rejected: 0, applied };
  let cursor = "0";
  do {
    const page = await redisCommand(["SCAN", cursor, "MATCH", "doodle:auth:native:*", "COUNT", 100]);
    if (!Array.isArray(page) || page.length !== 2 || !/^\d+$/.test(String(page[0])) ||
        !Array.isArray(page[1]) || !page[1].every(key => typeof key === "string" && /^doodle:auth:native:[a-f0-9]{64}$/.test(key))) {
      throw new Error("Invalid native session migration response");
    }
    cursor = String(page[0]);
    for (const key of page[1] as string[]) {
      result.scanned += 1;
      if (!applied) continue;
      const session = await indexStoredNativeSession(key, await redisCommand(["GET", key]));
      if (session) result.indexed += 1;
      else result.rejected += 1;
    }
  } while (cursor !== "0");
  return result;
}
