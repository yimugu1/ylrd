import type OpenAI from "openai";
import { createOpenAICompatibleClient } from "./openai-client";
import { getSecret } from "./secrets";

export type VisionExtract = {
  inferredName: string;
  brandGuess: string;
  modelGuess: string;
  features: string[];
  visualDescription: string;
  /** 用于联网检索的短查询，优先使用第一条 */
  searchQueries: string[];
};

export type VisionAnalyzeResult = {
  data: VisionExtract | null;
  /** 最后一次上游 API 报错摘要（模型名错误、配额、权限等） */
  lastError?: string;
};

function getClient(): OpenAI | null {
  return createOpenAICompatibleClient();
}

function isGoogleGenerativeOpenAI(): boolean {
  return getSecret("OPENAI_BASE_URL").includes("generativelanguage.googleapis.com");
}

/** Google 直连：优先 2.5 Flash（当前主力），再回退旧版 */
function visionFallbackModels(): string[] {
  const base = getSecret("OPENAI_BASE_URL")?.trim() || "";
  if (base.includes("generativelanguage.googleapis.com")) {
    return ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  }
  // OpenRouter: 优先自动路由，再尝试常见视觉模型
  return [
    "mistralai/pixtral-large-2411",
    "openrouter/auto",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-001",
    "qwen/qwen2.5-vl-72b-instruct:free",
    "meta-llama/llama-3.2-90b-vision-instruct:free",
    "google/gemma-3-27b-it:free",
  ];
}

function uniqueModels(primary: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of [primary, ...visionFallbackModels()]) {
    const t = m.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function extractJsonObject(t: string): string | null {
  const cleaned = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""));
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return null;
}

function parseVision(text: string): Partial<VisionExtract> | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<VisionExtract>;
  } catch {
    const extracted = extractJsonObject(raw);
    if (!extracted) return null;
    try {
      return JSON.parse(extracted) as Partial<VisionExtract>;
    } catch {
      return null;
    }
  }
}

function coerceStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function normalizeVision(parsed: Partial<VisionExtract>): VisionExtract {
  return {
    inferredName: String(parsed.inferredName || "图中商品").trim() || "图中商品",
    brandGuess: String(parsed.brandGuess || "").trim(),
    modelGuess: String(parsed.modelGuess || "").trim(),
    features: coerceStringArray(parsed.features).slice(0, 12),
    visualDescription: String(parsed.visualDescription || "").trim(),
    searchQueries: coerceStringArray(parsed.searchQueries)
      .map((s) => s.slice(0, 120))
      .filter(Boolean)
      .slice(0, 6),
  };
}

function looksLikeVisionFailureText(text: string): boolean {
  const t = text.toLowerCase();
  const badSnippets = [
    "无法查看",
    "不能查看",
    "无法识别图片",
    "看不到图片",
    "未收到图片",
    "请提供图片",
    "i can't view",
    "cannot view image",
    "can't analyze images",
    "does not support image",
    "model does not support",
    "invalid image",
  ];
  return badSnippets.some((s) => t.includes(s));
}

function visionFromLooseText(text: string): VisionExtract | null {
  const t = text.replace(/\r/g, "").trim();
  if (t.length < 15 || looksLikeVisionFailureText(t)) return null;
  const oneLine = t.split("\n").find((l) => l.trim().length > 3)?.trim() || t.slice(0, 80);
  const q = [oneLine.slice(0, 80), t.slice(0, 120).replace(/\s+/g, " ")].filter(Boolean);
  return {
    inferredName: oneLine.slice(0, 40) || "图中商品",
    brandGuess: "",
    modelGuess: "",
    features: [],
    visualDescription: t.slice(0, 1200),
    searchQueries: Array.from(new Set(q)).slice(0, 4),
  };
}

type ImageDetail = "high" | "low" | "auto";

function formatApiError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return e instanceof Error ? e.message : String(e);
}

async function chatVision(
  client: OpenAI,
  model: string,
  system: string,
  dataUrl: string,
  detail: ImageDetail,
  jsonFormat: boolean,
  googleSingleUser: boolean
): Promise<{ text: string | null; error?: string }> {
  try {
    const userInstruction = "请分析这张产品图并输出 JSON。";
    const content = googleSingleUser
      ? ([
          { type: "text" as const, text: `${system}\n\n${userInstruction}` },
          { type: "image_url" as const, image_url: { url: dataUrl } },
        ] as const)
      : ([
          { type: "text" as const, text: userInstruction },
          {
            type: "image_url" as const,
            image_url: { url: dataUrl, detail },
          },
        ] as const);

    const messages = googleSingleUser
      ? [{ role: "user" as const, content: [...content] }]
      : [
          { role: "system" as const, content: system },
          { role: "user" as const, content: [...content] },
        ];

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 1400,
      messages,
      ...(jsonFormat && !googleSingleUser ? { response_format: { type: "json_object" as const } } : {}),
      ...(jsonFormat && googleSingleUser ? {} : {}),
    });
    const text = completion.choices[0]?.message?.content?.trim() || null;
    return { text };
  } catch (e) {
    return { text: null, error: formatApiError(e) };
  }
}

const SYSTEM_JSON =
  "你是消费电子产品与通用商品识图专家。根据用户上传的产品照片，识别可见的品牌、型号/系列（若印刷或铭牌可读）、品类、颜色材质、设计特征。输出严格 JSON，字段：inferredName（建议的商品简称）、brandGuess、modelGuess（无法确定可为空字符串）、features（字符串数组，3-8条外观与功能可见特征）、visualDescription（一段中文客观描述图中所见）、searchQueries（2-4条适合搜索引擎的短查询，用于查型号、卖点与受众，用中文或中英文混合）。不要输出 markdown 或代码块外的多余文字。";

const SYSTEM_JSON_SHORT =
  "你是商品识图专家。根据照片输出一个 JSON 对象，只含字段 inferredName、brandGuess、modelGuess、features、visualDescription、searchQueries。只输出 JSON，不要其他文字。";

function tryParseVisionText(text: string | null): VisionExtract | null {
  if (!text) return null;
  const parsed = parseVision(text);
  if (parsed) return normalizeVision(parsed);
  return visionFromLooseText(text);
}

/**
 * 使用多模态模型识别产品图。
 * Google 直连：单条 user 多模态消息（比 system+user 更稳）；不强制 json_object（部分模型会拒）。
 */
export async function analyzeProductImageBase64(
  base64: string,
  mimeType: string
): Promise<VisionAnalyzeResult> {
  const client = getClient();
  if (!client) return { data: null, lastError: "未配置 OPENAI_API_KEY" };
  const openai = client;

  const google = isGoogleGenerativeOpenAI();
  const primary =
    getSecret("OPENAI_VISION_MODEL")?.trim() ||
    getSecret("OPENAI_MODEL")?.trim() ||
    "openrouter/free";
  const models = uniqueModels(primary);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const modelErrors = new Map<string, string>();

  async function runAttempts(model: string): Promise<VisionExtract | null> {
    const details: ImageDetail[] = google ? ["auto"] : ["high", "low"];

    for (const detail of details) {
      for (const jsonFormat of [false, true] as const) {
        const r1 = await chatVision(openai, model, SYSTEM_JSON, dataUrl, detail, jsonFormat, google);
        if (r1.error) modelErrors.set(model, r1.error.slice(0, 220));
        const v1 = tryParseVisionText(r1.text);
        if (v1) return v1;
      }
    }

    for (const jsonFormat of [false, true] as const) {
      const r2 = await chatVision(openai, model, SYSTEM_JSON_SHORT, dataUrl, "high", jsonFormat, google);
      if (r2.error) modelErrors.set(model, r2.error.slice(0, 220));
      const v2 = tryParseVisionText(r2.text);
      if (v2) return v2;
    }

    return null;
  }

  for (const model of models) {
    const got = await runAttempts(model);
    if (got) return { data: got };
  }

  const merged = Array.from(modelErrors.entries())
    .slice(0, 6)
    .map(([m, err]) => `${m}: ${err}`)
    .join(" | ");
  return {
    data: null,
    lastError: merged || "模型无返回或解析失败",
  };
}
