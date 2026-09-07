import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const INDEX_KEY = "doodle:reports:index";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReportRecord = {
  id: string;
  createdAt: string;
  reason: string;
  details: string;
  locale: string;
  includeContent: boolean;
  scene?: string;
  image?: { mimeType: string; base64: string; width: number; height: number };
};

function required(name: "KV_REST_API_URL" | "KV_REST_API_TOKEN") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function redis(command: unknown[]) {
  const response = await fetch(required("KV_REST_API_URL"), {
    method: "POST",
    headers: { Authorization: `Bearer ${required("KV_REST_API_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Redis request failed (${response.status})`);
  const payload = await response.json() as { result?: unknown };
  if (!("result" in payload)) throw new Error("Redis returned an invalid response");
  return payload.result;
}

function reportId(value: string | undefined) {
  if (!value || !UUID_PATTERN.test(value)) throw new Error("A valid report ID is required");
  return value.toLowerCase();
}

function parseRecord(value: unknown): ReportRecord | null {
  if (typeof value !== "string") return null;
  try {
    const record = JSON.parse(value) as Partial<ReportRecord>;
    if (!record || typeof record.id !== "string" || !UUID_PATTERN.test(record.id) || typeof record.createdAt !== "string" || typeof record.reason !== "string" || typeof record.details !== "string" || typeof record.locale !== "string" || typeof record.includeContent !== "boolean") return null;
    return record as ReportRecord;
  } catch {
    return null;
  }
}

async function getReport(id: string) {
  const record = parseRecord(await redis(["GET", `doodle:report:${id}`]));
  if (!record) throw new Error(`Report ${id} was not found or is invalid`);
  return record;
}

async function listReports() {
  const ids = await redis(["ZREVRANGE", INDEX_KEY, 0, 99]);
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) throw new Error("Report index is invalid");
  if (ids.length === 0) {
    console.log("No reports awaiting review.");
    return;
  }
  console.log("Latest reports awaiting review (up to 100):");
  const values = await redis(["MGET", ...ids.map((id) => `doodle:report:${id}`)]);
  if (!Array.isArray(values)) throw new Error("Report records are invalid");
  console.table(values.map(parseRecord).filter((record): record is ReportRecord => record !== null).map((record) => ({
    id: record.id,
    createdAt: record.createdAt,
    reason: record.reason,
    locale: record.locale,
    contentIncluded: record.includeContent,
  })));
}

async function showReport(id: string) {
  const record = await getReport(id);
  console.log(JSON.stringify({
    id: record.id,
    createdAt: record.createdAt,
    reason: record.reason,
    locale: record.locale,
    details: record.details,
    includeContent: record.includeContent,
    scene: record.scene,
    image: record.image ? { mimeType: record.image.mimeType, width: record.image.width, height: record.image.height } : undefined,
  }, null, 2));
}

async function extractImage(id: string) {
  const record = await getReport(id);
  if (!record.image || record.image.mimeType !== "image/jpeg") throw new Error("This report has no review image");
  const bytes = Buffer.from(record.image.base64, "base64");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new Error("The stored review image is not a JPEG");
  const directory = path.resolve(process.cwd(), "report-review");
  const destination = path.join(directory, `${id}.jpg`);
  if (path.dirname(destination) !== directory) throw new Error("Invalid image destination");
  await mkdir(directory, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  console.log(destination);
}

async function deleteReport(id: string) {
  const result = await redis(["EVAL", "local removed = redis.call('DEL', KEYS[1]); redis.call('ZREM', KEYS[2], ARGV[1]); return removed", "2", `doodle:report:${id}`, INDEX_KEY, id]);
  if (Number(result) !== 1) throw new Error(`Report ${id} was not found`);
  console.log(`Deleted reviewed report ${id}.`);
}

const [command = "list", rawId] = process.argv.slice(2);
if (command === "list") await listReports();
else if (command === "show") await showReport(reportId(rawId));
else if (command === "extract") await extractImage(reportId(rawId));
else if (command === "delete") await deleteReport(reportId(rawId));
else {
  console.error("Usage: review-reports.mts [list|show <id>|extract <id>|delete <id>]");
  process.exitCode = 1;
}
