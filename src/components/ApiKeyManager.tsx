"use client";

import { useState } from "react";

type AiProvider = "gemini" | "openrouter";

export function ApiKeyManager() {
  const [provider, setProvider] = useState<AiProvider>("openrouter");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [tavilyApiKey, setTavilyApiKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, string> = {};
      if (openaiApiKey.trim()) payload.OPENAI_API_KEY = openaiApiKey.trim();
      if (tavilyApiKey.trim()) payload.TAVILY_API_KEY = tavilyApiKey.trim();
      if (provider === "gemini") {
        // Google AI Studio：OpenAI 兼容端点，多模态识图稳定；免费额度见 ai.google.dev 说明
        payload.OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
        payload.OPENAI_MODEL = "gemini-2.5-flash";
        payload.OPENAI_VISION_MODEL = "gemini-2.5-flash";
      } else {
        payload.OPENAI_BASE_URL = "https://openrouter.ai/api/v1";
        payload.OPENAI_MODEL = "openrouter/free";
        payload.OPENAI_VISION_MODEL = "mistralai/pixtral-large-2411";
      }

      const r = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "保存失败");
        return;
      }
      setMsg(
        j?.verifiedVisionModel
          ? `保存成功：识图模型已自动验证并设置为 ${j.verifiedVisionModel}（无需重启）。`
          : "保存成功：之后调用将使用新配置（无需重启）。"
      );
      setOpenaiApiKey("");
      setTavilyApiKey("");
    } catch {
      setMsg("网络错误：保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#131820] p-6">
      <h2 className="text-lg font-semibold text-white">API Key 配置</h2>
      <p className="mt-1 text-sm text-zinc-400">
        需要两项：<strong className="text-zinc-300">AI 接口</strong>（文案+识图）与{" "}
        <strong className="text-zinc-300">Tavily</strong>（仅联网搜索）。若你当前网络访问 Google 不稳定，请优先选 OpenRouter；若网络通畅可用「Google Gemini」，在{" "}
        <a
          className="text-cyan-400/90 underline hover:text-cyan-300"
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
        >
          Google AI Studio
        </a>{" "}
        创建 Key（通常以 <code className="text-zinc-500">AIza</code> 开头）。也可改用 OpenRouter。
      </p>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-sm text-zinc-400">AI 接口提供商</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-zinc-200">
            <input
              type="radio"
              name="ai-provider"
              checked={provider === "gemini"}
              onChange={() => setProvider("gemini")}
              className="accent-cyan-500"
            />
            Google Gemini（有免费额度；部分地区/网络可能超时）
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-zinc-200">
            <input
              type="radio"
              name="ai-provider"
              checked={provider === "openrouter"}
              onChange={() => setProvider("openrouter")}
              className="accent-cyan-500"
            />
            OpenRouter
          </label>
        </div>
      </fieldset>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm text-zinc-400">
            {provider === "gemini"
              ? "Gemini API Key（Google AI Studio，必填）"
              : "OpenRouter API Key（必填）"}
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
            placeholder={provider === "gemini" ? "AIza…" : "sk-or-v1-…"}
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-400">联网检索 API Key（Tavily，可选但建议）</span>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
            placeholder="tvly-xxxx"
            value={tavilyApiKey}
            onChange={(e) => setTavilyApiKey(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !openaiApiKey.trim()}
          className="w-full rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-[#0c0f14] transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存并立即生效"}
        </button>

        {msg && (
          <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
            {msg}
          </p>
        )}
      </div>
    </section>
  );
}

