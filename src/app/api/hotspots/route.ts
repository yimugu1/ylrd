import { NextResponse } from "next/server";
import { getHotspots } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  // 临时演示/开发：允许匿名读取热点列表，避免别人打开隧道地址时因 401
  // 导致页面显示“加载失败”。生产环境仍保持鉴权（由 /api/hotspots/sync 等接口控制）。
  const allowAnonymousRead =
    process.env.HOTSPOTS_PUBLIC === "1" ||
    process.env.NODE_ENV !== "production";

  if (!allowAnonymousRead) {
    // 延后 import，避免在匿名模式下无谓的依赖/开销
    const { requireAuth } = await import("@/lib/auth");
    const auth = requireAuth();
    if (!("role" in auth)) return auth;
  }
  const list = await getHotspots();
  return NextResponse.json({ hotspots: list });
}
