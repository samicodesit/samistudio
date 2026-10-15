import { NextResponse } from "next/server";
import { getPlayCatalog } from "@/lib/billing/play-catalog";
export const dynamic = "force-dynamic";
export function GET() {
 try { return NextResponse.json(getPlayCatalog(),{headers:{"Cache-Control":"no-store"}}); }
 catch {return NextResponse.json({error:"play_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
