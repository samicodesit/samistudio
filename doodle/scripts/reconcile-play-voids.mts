import { getPlayBillingConfig } from "../src/lib/billing/play-config";
import { listPlayVoidReviews } from "../src/lib/billing/play-credits";
import { createPlayVoidsClient, reconcilePlayVoids } from "../src/lib/billing/play-voids";

const DAY_MS = 86_400_000;

function usage(): never {
  throw new Error("Usage: reconcile-play-voids.mts [--days=<1..30>] [--apply] | --review");
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const review = args.includes("--review");
  const daysArgument = args.find((argument) => argument.startsWith("--days="));
  if (args.some((argument) => argument !== "--apply" && argument !== "--review" && !argument.startsWith("--days="))) usage();
  if (review) {
    if (apply || daysArgument) usage();
    const entries = await listPlayVoidReviews();
    if (entries.length === 0) {
      console.log("No Play void residuals awaiting review.");
      return;
    }
    console.table(entries.map((entry) => ({ ...entry, purchaseHash: entry.purchaseHash.slice(0, 16) })));
    return;
  }

  const days = daysArgument ? Number(daysArgument.slice("--days=".length)) : 30;
  if (!Number.isInteger(days) || days < 1 || days > 30) usage();
  const config = getPlayBillingConfig();
  if (!config) throw new Error("Play billing is disabled or not configured");
  const nowMs = Date.now();
  // Keep a one-minute margin inside Google's strict 30-day lower bound.
  const startTimeMs = nowMs - days * DAY_MS + (days === 30 ? 60_000 : 0);
  const summary = await reconcilePlayVoids({
    client: createPlayVoidsClient(config),
    startTimeMs,
    endTimeMs: nowMs,
    nowMs,
    apply,
  });
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) console.log("Dry run only. Re-run with --apply to write tombstones and reverse available credits.");
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  console.error(message.startsWith("Usage:") || message === "Play billing is disabled or not configured" ? message : "Play reconciliation failed");
  process.exitCode = 1;
}
