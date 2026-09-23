import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { redisCommand } from "@/lib/redis";
import { TRIAL_TTL_SECONDS, type TrialIdentity } from "@/lib/generation/free-allowance";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function identityKey(installId: string) {
  return "doodle:native:trial:" + createHash("sha256").update(installId).digest("hex");
}

export async function getOrCreateNativeTrialIdentity(installId: string): Promise<TrialIdentity> {
  if (!UUID_PATTERN.test(installId)) throw new Error("Invalid native installation");
  const normalizedInstallId = installId.toLowerCase();
  const key = identityKey(normalizedInstallId);

  const candidate = randomUUID();
  const created = await redisCommand([
    "SET",
    key,
    candidate,
    "EX",
    TRIAL_TTL_SECONDS,
    "NX",
  ]);
  if (created === "OK") return { id: candidate };

  const existing = await redisCommand(["GET", key]);
  if (typeof existing === "string" && UUID_PATTERN.test(existing)) return { id: existing };
  throw new Error("Native installation identity unavailable");
}
