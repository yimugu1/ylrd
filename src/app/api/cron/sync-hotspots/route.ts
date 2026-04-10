import { NextResponse } from "next/server";
import { upsertHotspots } from "@/lib/store";
import { fetchHotspotsForSync } from "@/lib/social-hotspots";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 供外部定时任务（如 crontab、Windows 计划任务、Vercel Cron）每日调用。
 * 请求头需带 Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (secret && token !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const items = await fetchHotspotsForSync();
  const added = await upsertHotspots(items);
  return NextResponse.json({
    ok: true,
    fetched: items.length,
    added,
    skipped: Math.max(0, items.length - added),
    at: new Date().toISOString(),
  });
}
