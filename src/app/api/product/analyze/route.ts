import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { analyzeProductWithAi } from "@/lib/ai";
import { rankHotspots } from "@/lib/match";
import { getHotspots, saveProduct } from "@/lib/store";
import type { ProductAnalysis } from "@/lib/types";
import { analyzeProductImageBase64, type VisionExtract } from "@/lib/vision";
import { searchProductWebEnriched } from "@/lib/web-search";
import { getSecret } from "@/lib/secrets";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const jsonSchema = z.object({
  name: z.string().optional().default(""),
  description: z.string().optional().default(""),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional().default("image/jpeg"),
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function buildVisionText(v: VisionExtract) {
  const lines = [
    `建议名称：${v.inferredName}`,
    v.brandGuess ? `品牌线索：${v.brandGuess}` : "",
    v.modelGuess ? `型号线索：${v.modelGuess}` : "",
    v.features.length ? `可见特征：${v.features.join("；")}` : "",
    v.visualDescription ? `图像描述：${v.visualDescription}` : "",
    v.searchQueries.length ? `建议检索：${v.searchQueries.join(" | ")}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth();
    if (!("role" in auth)) return auth;
    let name = "";
    let description = "";
    let imageBase64: string | undefined;
    let mimeType = "image/jpeg";

    const ct = request.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      name = String(form.get("name") ?? "").trim();
      description = String(form.get("description") ?? "").trim();
      const file = form.get("image");
      if (file && typeof file !== "string" && "arrayBuffer" in file) {
        const buf = Buffer.from(await file.arrayBuffer());
        if (buf.length > MAX_IMAGE_BYTES) {
          return NextResponse.json(
            { ok: false, error: `图片过大（最大 ${MAX_IMAGE_BYTES / 1024 / 1024}MB）` },
            { status: 400 }
          );
        }
        if (buf.length > 0) {
          imageBase64 = buf.toString("base64");
          mimeType = (file as File).type || "image/jpeg";
        }
      }
    } else {
      const json = await request.json();
      const parsed = jsonSchema.parse(json);
      name = parsed.name.trim();
      description = parsed.description.trim();
      imageBase64 = parsed.imageBase64?.trim() || undefined;
      mimeType = parsed.mimeType || "image/jpeg";
      if (imageBase64) {
        const approxBytes = (imageBase64.length * 3) / 4;
        if (approxBytes > MAX_IMAGE_BYTES) {
          return NextResponse.json(
            { ok: false, error: `图片过大（最大 ${MAX_IMAGE_BYTES / 1024 / 1024}MB）` },
            { status: 400 }
          );
        }
      }
    }

    if (!name && !imageBase64) {
      return NextResponse.json(
        { ok: false, error: "请填写产品名称，或上传产品图片" },
        { status: 400 }
      );
    }

    let visionSummary: string | undefined;
    let webSearchSummary: string | undefined;
    const hasTextInput = Boolean(name.trim() || description.trim());

    if (imageBase64) {
      const visionResult = await analyzeProductImageBase64(imageBase64, mimeType);
      const vision = visionResult.data;
      if (!vision) {
        if (!hasTextInput) {
          const hint =
            visionResult.lastError?.slice(0, 280) ||
            "模型无返回或解析失败（请确认 Google AI Studio 已启用 Generative Language API，且模型名可用）。";
          const base = getSecret("OPENAI_BASE_URL");
          const modelSuggestion = base.includes("openrouter.ai")
            ? "openrouter/auto（或 openai/gpt-4o-mini）"
            : "gemini-2.5-flash";
          return NextResponse.json(
            {
              ok: false,
              error: `图片识别失败：${hint} 建议在密钥页将模型设为 ${modelSuggestion} 并保存后重试。`,
            },
            { status: 400 }
          );
        }
        visionSummary =
          "图片识别未成功：请确认已配置 OPENAI_API_KEY，并在密钥页将识图模型设为支持 vision 的模型（如 gemini-2.5-flash）。已继续使用名称/描述分析。";
      } else {
        visionSummary = buildVisionText(vision);
        if (!name) name = vision.inferredName || "未命名产品";

        const q =
          vision.searchQueries[0] ||
          [vision.brandGuess, vision.modelGuess].filter(Boolean).join(" ") ||
          vision.inferredName;
        if (q.trim()) {
          try {
            const web = await searchProductWebEnriched(q.trim(), vision.searchQueries.slice(1));
            webSearchSummary = web || undefined;
            if (!web && !getSecret("TAVILY_API_KEY")?.trim()) {
              webSearchSummary =
                "（未配置 TAVILY_API_KEY，已跳过联网检索。配置后可自动搜索卖点、参数与受众。）";
            }
          } catch (e) {
            webSearchSummary = `联网检索出错：${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }
    }

    let fullDescription = description;
    if (visionSummary) fullDescription += `${fullDescription ? "\n\n" : ""}【图片识别】\n${visionSummary}`;
    if (webSearchSummary)
      fullDescription += `${fullDescription ? "\n\n" : ""}【联网检索】\n${webSearchSummary}`;

    const partial = await analyzeProductWithAi(name, fullDescription);
    const product: ProductAnalysis = {
      ...partial,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      visionSummary,
      webSearchSummary,
    };
    await saveProduct(product);

    const hotspots = await getHotspots();
    const matches = rankHotspots(
      hotspots,
      product.keywords,
      product.sellingPoints,
      12
    );

    return NextResponse.json({
      product,
      matches,
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
      { ok: false, error: e instanceof Error ? e.message : "分析失败" },
      { status: 500 }
    );
  }
}
