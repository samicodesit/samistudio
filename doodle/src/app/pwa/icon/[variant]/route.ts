import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const dynamic = "force-static";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (!["192", "512", "maskable"].includes(variant)) return new Response("Not found", { status: 404 });
  const bytes = await readFile(join(process.cwd(), "public/icons", `doodle-${variant}.png`));
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
}
