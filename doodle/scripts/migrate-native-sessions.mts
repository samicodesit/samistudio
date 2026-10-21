import { migrateNativeSessionIndex } from "../src/lib/auth/native-session-migration";

const args = process.argv.slice(2);
if (args.length > 1 || args.some(argument => argument !== "--apply")) {
  throw new Error("Usage: migrate-native-sessions.mts [--apply]");
}

try {
  // Report counts only. Never print session values, token hashes or account IDs.
  console.log(JSON.stringify(await migrateNativeSessionIndex(args.includes("--apply"))));
} catch {
  console.error("Native session migration failed. No success is claimed; investigate and rerun before release.");
  process.exitCode = 1;
}
