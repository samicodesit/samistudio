import "dotenv/config";
import { grantComplimentaryCredits } from "../src/lib/billing/complimentary-credits";
import { redisCommand } from "../src/lib/redis";

const args = process.argv.slice(2);
function value(name: string) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[index + 1];
}
const allowed = new Set(["--account", "--grant", "--credits", "--reason", "--apply"]);
for (let index = 0; index < args.length; index++) {
  if (!allowed.has(args[index])) throw new Error("Unknown argument");
  if (args[index] !== "--apply") index++;
}
const accountId = value("--account");
const input = { grantId: value("--grant"), credits: Number(value("--credits")), reason: value("--reason") };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuid.test(accountId) || !uuid.test(input.grantId) || !Number.isSafeInteger(input.credits) || input.credits < 1 || input.credits > 500 || !/^[a-z0-9_]{1,80}$/.test(input.reason)) throw new Error("Invalid grant");
const prefix = `doodle:account:${accountId}:`;
if (!args.includes("--apply")) {
  const state = await redisCommand(["MGET", prefix + "active", prefix + "deleted", prefix + "balance"]);
  if (!Array.isArray(state) || state[0] !== "1" || state[1] !== null) throw new Error("Account is not active");
  console.log(JSON.stringify({ dryRun: true, credits: input.credits, reason: input.reason, currentBalance: Number(state[2] ?? 0), grantAlreadyRecorded: await redisCommand(["HEXISTS", prefix + "grants", input.grantId]) === 1 }));
} else {
  console.log(JSON.stringify({ ...await grantComplimentaryCredits(accountId, input), grantId: input.grantId }));
}
