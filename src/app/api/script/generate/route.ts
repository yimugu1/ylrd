import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { generateAdScript } from "@/lib/ai";
import { rankHotspots } from "@/lib/match";
import { getHotspots, getProduct, saveScript } from "@/lib/store";
import type { GeneratedScript } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  productId: z.string().uuid(),
  forceStandalone: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = requireAuth();
    if (!("role" in auth)) return auth;
    const json = await request.json();
    const { productId, forceStandalone } = bodySchema.parse(json);
    const product = await getProduct(productId);
    if (!product) {
      return NextResponse.json({ ok: false, error: "未找到产品分析记录" }, { status: 404 });
    }

    const hotspots = await getHotspots();
    const ranked = rankHotspots(
      hotspots,
      product.keywords,
      product.sellingPoints,
      5
    );
    let matched = ranked.map((r) => r.hotspot);
    if (forceStandalone) matched = [];

    const standalone = forceStandalone === true || matched.length === 0;
    const { content, outline } = await generateAdScript(product, matched, standalone);

    const script: GeneratedScript = {
      id: randomUUID(),
      createdBy: auth.username,
      productId,
      matchedHotspotIds: matched.map((h) => h.id),
      content,
      outline,
      createdAt: new Date().toISOString(),
      mode: standalone ? "standalone" : "matched",
    };
    await saveScript(script);

    return NextResponse.json({
      script,
      matchedHotspots: matched,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: e.issues[0]?.message ?? "参数错误" },
        { status: 400 }
      );
    }
    console.error(e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "生成失败" },
      { status: 500 }
    );
  }
}
