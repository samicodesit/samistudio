import "server-only";
import { redisCommand } from "@/lib/redis";
export type CreditScope = "production" | "apple-sandbox";
// This record is written only after an Apple-verified grant. Client flags never set it.
export async function getAppleCreditScope(request: Request, accountId: string): Promise<CreditScope> {
  if (request.headers.get("x-doodle-client") !== "native-ios") return "production";
  if (!/^[a-f0-9-]{36}$/i.test(accountId)) throw new Error("Invalid billing account");
  const environment = await redisCommand(["HGET", `doodle:account:${accountId}:apple-billing-environment`, "environment"]);
  if (environment === "Sandbox") return "apple-sandbox";
  if (environment === null || environment === "Production") return "production";
  throw new Error("Invalid billing environment");
}
