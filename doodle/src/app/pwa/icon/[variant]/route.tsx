import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> },
) {
  const { variant } = await params;
  if (variant !== "192" && variant !== "512" && variant !== "maskable") {
    return new Response("Not found", { status: 404 });
  }

  const size = variant === "192" ? 192 : 512;
  const maskable = variant === "maskable";
  const tileSize = maskable ? "80%" : "92%";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef1ea" }}>
        <div style={{ width: tileSize, height: tileSize, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(32,35,31,0.18)", borderRadius: "18% 16% 20% 15%", background: "#f4d85e", boxShadow: "8px 10px 0 rgba(32,35,31,0.08)", color: "#20231f", fontFamily: "Arial, sans-serif", fontSize: size * 0.5, fontWeight: 700, letterSpacing: "-0.08em" }}>
          D<span style={{ color: "#195c47" }}>.</span>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}
