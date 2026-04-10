import OpenAI from "openai";
import { getSecret } from "./secrets";

/** 与 OpenAI 兼容的网关（OpenRouter / Google Gemini OpenAI 兼容层等） */
export function createOpenAICompatibleClient(): OpenAI | null {
  const key = getSecret("OPENAI_API_KEY").trim();
  if (!key.length || key.length < 8) return null;

  const baseURL = getSecret("OPENAI_BASE_URL").trim() || undefined;
  const isGoogle = baseURL?.includes("generativelanguage.googleapis.com");

  return new OpenAI({
    apiKey: key,
    baseURL,
    ...(isGoogle
      ? {
          // Gemini 官方 REST 常用 x-goog-api-key；OpenAI 兼容层仍会通过 SDK 带 Bearer
          defaultHeaders: { "x-goog-api-key": key },
        }
      : {}),
  });
}

export function isGeminiOpenAICompat(): boolean {
  const baseURL = getSecret("OPENAI_BASE_URL").trim();
  return baseURL.includes("generativelanguage.googleapis.com");
}
