import { NextResponse } from "next/server";
import { getSecret, getSecretsForClient, setSecrets } from "@/lib/secrets";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const bodySchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_VISION_MODEL: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
});

export const dynamic = "force-dynamic";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2ioAAAAASUVORK5CYII=";

function dedupe(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of items.map((x) => x.trim()).filter(Boolean)) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function canUseVisionModel(baseURL: string, apiKey: string, model: string): Promise<{ ok: boolean; err?: string }> {
  try {
    const r = await fetch(`${baseURL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 30,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "请简要描述这张图片。" },
              { type: "image_url", image_url: { url: `data:image/png;base64,${TINY_PNG_BASE64}` } },
            ],
          },
        ],
      }),
    });
    if (r.ok) return { ok: true };
    const t = await r.text();
    let msg = t;
    try {
      const j = JSON.parse(t) as { error?: { message?: string } };
      msg = j?.error?.message || t;
    } catch {}
    return { ok: false, err: msg.slice(0, 180) };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message.slice(0, 180) : String(e).slice(0, 180) };
  }
}

async function chooseVisionModel(baseURL: string, apiKey: string, preferred: string): Promise<{ model?: string; reason?: string }> {
  const isGoogle = baseURL.includes("generativelanguage.googleapis.com");
  const candidates = isGoogle
    ? dedupe([preferred, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"])
    : dedupe([
        preferred,
        "mistralai/pixtral-large-2411",
        "openrouter/auto",
        "openai/gpt-4o-mini",
        "google/gemini-2.0-flash-001",
      ]);

  const errors: string[] = [];
  for (const model of candidates) {
    const r = await canUseVisionModel(baseURL, apiKey, model);
    if (r.ok) return { model };
    if (r.err) errors.push(`${model}: ${r.err}`);
  }
  return { reason: errors.slice(0, 4).join(" | ") || "未找到可用识图模型" };
}

export async function GET() {
  const auth = requireAdmin();
  if (!("role" in auth)) return auth;
  return NextResponse.json(getSecretsForClient());
}

export async function POST(request: Request) {
  const auth = requireAdmin();
  if (!("role" in auth)) return auth;
  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }

  const parsed = bodySchema.parse(json);
  const partial: Record<string, string> = {};

  // 只更新用户明确提供的字段（避免把未输入的空值覆盖掉已有配置）
  if (parsed.OPENAI_API_KEY !== undefined) partial.OPENAI_API_KEY = String(parsed.OPENAI_API_KEY).trim();
  if (parsed.OPENAI_BASE_URL !== undefined) partial.OPENAI_BASE_URL = String(parsed.OPENAI_BASE_URL).trim();
  if (parsed.OPENAI_MODEL !== undefined) partial.OPENAI_MODEL = String(parsed.OPENAI_MODEL).trim();
  if (parsed.OPENAI_VISION_MODEL !== undefined) {
    partial.OPENAI_VISION_MODEL = String(parsed.OPENAI_VISION_MODEL).trim();
  }
  if (parsed.TAVILY_API_KEY !== undefined) partial.TAVILY_API_KEY = String(parsed.TAVILY_API_KEY).trim();

  const effectiveBaseURL =
    partial.OPENAI_BASE_URL || getSecret("OPENAI_BASE_URL") || "https://openrouter.ai/api/v1";
  const effectiveApiKey = partial.OPENAI_API_KEY || getSecret("OPENAI_API_KEY");
  const preferredVisionModel =
    partial.OPENAI_VISION_MODEL || getSecret("OPENAI_VISION_MODEL") || getSecret("OPENAI_MODEL") || "openrouter/auto";

  let verifiedVisionModel: string | undefined;
  if (effectiveApiKey.trim()) {
    const picked = await chooseVisionModel(effectiveBaseURL, effectiveApiKey.trim(), preferredVisionModel);
    if (!picked.model) {
      return NextResponse.json(
        {
          ok: false,
          error: `保存失败：当前配置未找到可用识图模型。${picked.reason || ""}`,
        },
        { status: 400 }
      );
    }
    verifiedVisionModel = picked.model;
    partial.OPENAI_VISION_MODEL = picked.model;
  }

  setSecrets(partial);

  return NextResponse.json({
    ok: true,
    verifiedVisionModel,
    // 返回给前端的配置展示值（keys 不返回真实值）
    config: getSecretsForClient(),
  });
}

