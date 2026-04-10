import type { Hotspot, ProductAnalysis } from "./types";
import { createOpenAICompatibleClient, isGeminiOpenAICompat } from "./openai-client";
import { getSecret } from "./secrets";

function getClient() {
  return createOpenAICompatibleClient();
}

export async function analyzeProductWithAi(
  name: string,
  description: string
): Promise<Omit<ProductAnalysis, "id" | "createdAt">> {
  const client = getClient();
  const fallback = heuristicAnalyze(name, description);

  if (!client) {
    return {
      name,
      rawDescription: description,
      sellingPoints: fallback.sellingPoints,
      audience: fallback.audience,
      keywords: fallback.keywords,
      researchSummary:
        "未配置 OPENAI_API_KEY，已使用本地启发式提取。配置后可获得更精准的卖点与受众分析。",
    };
  }

  let completionText = "";
  const model = getSecret("OPENAI_MODEL") || "openrouter/free";
  const messages = [
    {
      role: "system" as const,
      content:
        "你是资深营销与信息流广告策划。根据产品名称与描述分析；若描述含「图片识别」须用其中的品牌/型号/外观特征；若含「联网检索」须优先依据其中的网页摘要提炼卖点与受众，不得忽略联网段落。输出 JSON：sellingPoints（3-6条，可含差异化与场景）、audience（2-4条具体人群标签）、keywords（8-15个）、researchSummary（概括定位与传播点）。只输出合法 JSON，不要 markdown。",
    },
    {
      role: "user" as const,
      content: `产品名称：${name}\n\n产品描述：\n${description || "（无）"}`,
    },
  ];
  try {
    const gemini = isGeminiOpenAICompat();
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      messages,
      ...(gemini ? {} : { response_format: { type: "json_object" as const } }),
    });
    completionText = completion.choices[0]?.message?.content || "{}";
  } catch (e) {
    // 兼容 OpenRouter 免费路由偶发不支持 response_format / 模型能力问题
    const err = e instanceof Error ? e.message : String(e);
    return {
      name,
      rawDescription: description,
      ...fallback,
      researchSummary: `（AI 路由回退）模型调用失败：${err.slice(0, 120)}；已使用启发式结果继续。`,
    };
  }

  const text = completionText || "{}";
  let parsed: {
    sellingPoints?: string[];
    audience?: string[];
    keywords?: string[];
    researchSummary?: string;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      name,
      rawDescription: description,
      ...fallback,
      researchSummary: "模型返回解析失败，已回退到启发式结果。",
    };
  }

  return {
    name,
    rawDescription: description,
    sellingPoints: parsed.sellingPoints?.length ? parsed.sellingPoints : fallback.sellingPoints,
    audience: parsed.audience?.length ? parsed.audience : fallback.audience,
    keywords: parsed.keywords?.length ? parsed.keywords : fallback.keywords,
    researchSummary: parsed.researchSummary || "（无摘要）",
  };
}

function heuristicAnalyze(name: string, description: string) {
  const text = `${name} ${description}`;
  const keywords = Array.from(
    new Set(
      (text.match(/[\u4e00-\u9fa5]{2,8}|[a-zA-Z]{4,}/g) || []).slice(0, 12)
    )
  );
  return {
    sellingPoints: [
      "性价比高，满足日常核心需求",
      "品牌可塑性强，适合短视频种草",
      "使用场景清晰，便于信息流定向",
    ],
    audience: ["18-35 岁城市用户", "对新品敏感的内容消费者"],
    keywords: keywords.length ? keywords : ["产品", "消费", "生活方式"],
  };
}

export async function generateAdScript(
  product: ProductAnalysis,
  matched: Hotspot[],
  standalone: boolean
): Promise<{ content: string; outline: string[] }> {
  function toReadableLine(v: unknown): string {
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (!v || typeof v !== "object") return "";
    const o = v as Record<string, unknown>;
    const picked = [
      o.title,
      o.scene,
      o.beat,
      o.step,
      o.point,
      o.copy,
      o.text,
      o.voiceover,
      o.visual,
      o.description,
      o.content,
    ]
      .map((x) => (x == null ? "" : String(x).trim()))
      .filter(Boolean);
    if (picked.length) return picked.join(" | ");
    try {
      return JSON.stringify(o);
    } catch {
      return "";
    }
  }

  function toOutlineArray(v: unknown, fallback: string[]): string[] {
    if (!Array.isArray(v)) return fallback;
    const out = v.map(toReadableLine).filter(Boolean).slice(0, 10);
    return out.length ? out : fallback;
  }

  function toContentString(v: unknown): string {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(toReadableLine).filter(Boolean).join("\n");
    return toReadableLine(v);
  }

  const client = getClient();
  const hotspotsBlock =
    matched.length > 0
      ? matched
          .map(
            (h, i) =>
              `${i + 1}. [${h.source}] ${h.title}\n   摘要：${h.summary.slice(0, 200)}`
          )
          .join("\n")
      : "（无匹配热点，请自行结合产品做爆款结构）";

  const system =
    standalone || matched.length === 0
      ? "你是短视频/信息流广告脚本策划。根据产品与可选参考，写一条 45-60 秒口播+画面提示的脚本，分镜清晰。输出 JSON：outline（分镜要点数组 5-8 条）、content（完整脚本正文，含口播与画面）。中文。"
      : "你是短视频/信息流广告脚本策划。必须将下方「匹配热点」自然融入钩子或中段，避免生硬堆砌。输出 JSON：outline、content。中文。";

  const visionBlock = product.visionSummary
    ? `\n【图片识别】\n${product.visionSummary}`
    : "";
  const webBlock = product.webSearchSummary
    ? `\n【联网检索】\n${product.webSearchSummary}`
    : "";
  const user = `产品名称：${product.name}\n卖点：${product.sellingPoints.join("；")}\n受众：${product.audience.join("；")}\n关键词：${product.keywords.join("、")}\n研究摘要：${product.researchSummary}${visionBlock}${webBlock}\n\n匹配热点：\n${hotspotsBlock}`;

  if (!client) {
    const outline = [
      "0-3s：悬念/痛点钩子",
      "3-12s：产品亮相 + 核心卖点一",
      "12-25s：场景演示或对比",
      "25-40s：社会证明或数据",
      "40-55s：限时福利或行动号召",
    ];
    const content = `【口播】\n大家好，今天借${matched[0]?.title?.slice(0, 20) || "近期热议话题"}聊聊${product.name}。\n${product.sellingPoints[0] || "核心优势"}，特别适合${product.audience[0] || "目标用户"}。\n【画面】产品特写 → 使用场景 → 字幕强调卖点 → 结尾引导点击。\n\n（配置 OPENAI_API_KEY 后可生成更完整脚本。）`;
    return { content, outline };
  }

  let text = "{}";
  try {
    const gemini = isGeminiOpenAICompat();
    const completion = await client.chat.completions.create({
      model: getSecret("OPENAI_MODEL") || "openrouter/free",
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(gemini ? {} : { response_format: { type: "json_object" as const } }),
    });
    text = completion.choices[0]?.message?.content || "{}";
  } catch {
    // 生成脚本失败就回退到基础模板，避免页面白屏
    const fallbackOutline = [
      "0-3s：钩子",
      "3-15s：卖点展开",
      "15-35s：场景/证明",
      "35-50s：转化",
    ];
    const fallbackContent = `【口播】\n大家好，今天聊${product.name}。\n${product.sellingPoints[0] || "核心优势"}，特别适合${product.audience[0] || "目标用户"}。\\n【画面】产品特写 → 场景演示 → 字幕强调 → 引导点击。\n（当前 AI 生成不可用，已使用模板脚本。）`;
    return { content: fallbackContent, outline: fallbackOutline };
  }
  const defaultOutline = [
    "0-3s：钩子",
    "3-15s：卖点展开",
    "15-35s：场景/证明",
    "35-50s：转化",
  ];
  try {
    const parsed = JSON.parse(text) as { content?: unknown; outline?: unknown };
    const content = toContentString(parsed.content) || "（空）";
    const outline = toOutlineArray(parsed.outline, defaultOutline);
    return {
      content,
      outline,
    };
  } catch {
    return {
      content: text,
      outline: ["分镜解析失败，请查看正文"],
    };
  }
}
