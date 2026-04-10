import { NextResponse } from "next/server";
import { upsertHotspots } from "@/lib/store";
import { fetchHotspotsForSync } from "@/lib/social-hotspots";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const auth = requireAuth();
    if (!("role" in auth)) return auth;
    const items = await fetchHotspotsForSync();
    const added = await upsertHotspots(items);
    return NextResponse.json({
      ok: true,
      fetched: items.length,
      added,
      skipped: Math.max(0, items.length - added),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "同步失败" },
      { status: 500 }
    );
  }
}
