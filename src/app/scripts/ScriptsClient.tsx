"use client";

import { useCallback, useEffect, useState } from "react";
import { ClientErrorBoundary } from "@/components/ClientErrorBoundary";

type Product = {
  id: string;
  name: string;
  rawDescription: string;
  sellingPoints: string[];
  audience: string[];
  keywords: string[];
  researchSummary: string;
  createdAt: string;
  visionSummary?: string;
  webSearchSummary?: string;
};

type Match = { hotspot: Hotspot; score: number };
type Hotspot = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
};

type ScriptResult = {
  id: string;
  createdBy?: string;
  productId: string;
  matchedHotspotIds: string[];
  content: string;
  outline: string[];
  createdAt: string;
  mode: "matched" | "standalone";
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => {
    if (typeof x === "string") return x;
    if (typeof x === "number" || typeof x === "boolean") return String(x);
    if (!x || typeof x !== "object") return "";
    const o = x as Record<string, unknown>;
    const picked = [o.title, o.scene, o.beat, o.point, o.text, o.copy, o.content]
      .map((t) => (t == null ? "" : String(t)))
      .filter(Boolean);
    if (picked.length) return picked.join(" | ");
    try {
      return JSON.stringify(o);
    } catch {
      return "";
    }
  });
}

function normalizeProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "");
  const name = String(o.name ?? "");
  if (!id) return null;
  return {
    id,
    name: name || "未命名产品",
    rawDescription: String(o.rawDescription ?? ""),
    sellingPoints: asStringArray(o.sellingPoints),
    audience: asStringArray(o.audience),
    keywords: asStringArray(o.keywords),
    researchSummary: String(o.researchSummary ?? ""),
    createdAt: String(o.createdAt ?? ""),
    visionSummary:
      o.visionSummary !== undefined && o.visionSummary !== null
        ? String(o.visionSummary)
        : undefined,
    webSearchSummary:
      o.webSearchSummary !== undefined && o.webSearchSummary !== null
        ? String(o.webSearchSummary)
        : undefined,
  };
}

function normalizeHotspot(raw: unknown): Hotspot | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const id = String(h.id ?? "");
  if (!id) return null;
  return {
    id,
    title: String(h.title ?? ""),
    summary: String(h.summary ?? ""),
    source: String(h.source ?? ""),
    url: String(h.url ?? "#"),
  };
}

function normalizeMatch(raw: unknown): Match | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const hs = normalizeHotspot(m.hotspot);
  if (!hs) return null;
  const score = typeof m.score === "number" && !Number.isNaN(m.score) ? m.score : 0;
  return { hotspot: hs, score };
}

function normalizeScript(raw: unknown): ScriptResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "");
  if (!id) return null;
  return {
    id,
    createdBy:
      o.createdBy !== undefined && o.createdBy !== null ? String(o.createdBy) : undefined,
    productId: String(o.productId ?? ""),
    matchedHotspotIds: Array.isArray(o.matchedHotspotIds)
      ? o.matchedHotspotIds.map((x) => String(x))
      : [],
    content:
      typeof o.content === "string"
        ? o.content
        : Array.isArray(o.content)
          ? asStringArray(o.content).join("\n")
          : String(o.content ?? ""),
    outline: asStringArray(o.outline),
    createdAt: String(o.createdAt ?? ""),
    mode: o.mode === "standalone" ? "standalone" : "matched",
  };
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function ScriptsInner() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [generating, setGenerating] = useState(false);
  const [script, setScript] = useState<ScriptResult | null>(null);
  const [matchedHotspots, setMatchedHotspots] = useState<Hotspot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScriptResult[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/scripts");
      const text = await r.text();
      const parsed = text ? parseJsonSafe(text) : null;
      if (!parsed || typeof parsed !== "object") {
        setHistory([]);
        return;
      }
      const scripts = (parsed as { scripts?: unknown }).scripts;
      const raw = Array.isArray(scripts) ? scripts : [];
      const list = raw
        .map((x: unknown) => normalizeScript(x))
        .filter((x: ScriptResult | null): x is ScriptResult => x !== null);
      setHistory(list);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadHistory]);

  function onPickImage(f: File | null) {
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (!f) {
      setImageFile(null);
      return;
    }
    const max = 8 * 1024 * 1024;
    if (f.size > max) {
      setError(`图片请小于 ${max / 1024 / 1024}MB`);
      setImageFile(null);
      return;
    }
    setError(null);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setScript(null);
    setProduct(null);
    setMatches([]);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("description", description);
      if (imageFile) fd.append("image", imageFile);

      const r = await fetch("/api/product/analyze", {
        method: "POST",
        body: fd,
      });
      const text = await r.text();
      const j = parseJsonSafe(text) as Record<string, unknown> | null;
      if (!j || typeof j !== "object") {
        setError("服务器返回异常");
        return;
      }
      if (!r.ok) {
        setError(String(j.error || "分析失败"));
        return;
      }
      const p = normalizeProduct(j.product);
      if (!p) {
        setError("返回数据异常，请重试");
        return;
      }
      setProduct(p);
      const rawMatches = Array.isArray(j.matches) ? j.matches : [];
      setMatches(
        rawMatches
          .map((x: unknown) => normalizeMatch(x))
          .filter((x: Match | null): x is Match => x !== null)
      );
    } catch {
      setError("网络错误");
    } finally {
      setAnalyzing(false);
    }
  }

  async function genScript(forceStandalone: boolean) {
    if (!product) return;
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch("/api/script/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, forceStandalone }),
      });
      const text = await r.text();
      const j = parseJsonSafe(text) as Record<string, unknown> | null;
      if (!j || typeof j !== "object") {
        setError("服务器返回异常");
        return;
      }
      if (!r.ok) {
        setError(String(j.error || "生成失败"));
        return;
      }
      const scr = normalizeScript(j.script);
      if (!scr) {
        setError("脚本数据异常");
        return;
      }
      setScript(scr);
      const mh = Array.isArray(j.matchedHotspots) ? j.matchedHotspots : [];
      setMatchedHotspots(
        mh
          .map((x: unknown) => normalizeHotspot(x))
          .filter((x: Hotspot | null): x is Hotspot => x !== null)
      );
      await loadHistory();
    } catch {
      setError("网络错误");
    } finally {
      setGenerating(false);
    }
  }

  const selling = product?.sellingPoints ?? [];
  const audiences = product?.audience ?? [];
  const kws = product?.keywords ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">脚本制作区</h1>
        <p className="mt-1 text-sm text-zinc-400">
          可只填名称、或只上传产品图（会识图并联网检索型号与特征）；也可图文同时提供。分析后再与热点库匹配并生成脚本。建议先同步热点库。
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#131820] p-6">
        <h2 className="text-lg font-semibold text-white">1. 产品信息</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-400">产品名称（可留空，仅上传图片时由识图建议名称）</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              placeholder="例如：无线降噪耳机 X1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">产品描述（可选）</span>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              placeholder="卖点、价格带、渠道、竞品差异等"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="block">
            <span className="text-sm text-zinc-400">产品图片（可选）</span>
            <p className="mt-0.5 text-xs text-zinc-500">
              上传后将自动识图，并结合联网检索补充型号与特征（需配置 OPENAI_API_KEY 与 TAVILY_API_KEY）。
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="mt-2 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-200"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />
            {imagePreview && (
              <div className="mt-3 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="预览"
                  className="max-h-40 rounded-lg border border-white/10 object-contain"
                />
                <button
                  type="button"
                  className="text-xs text-zinc-500 underline hover:text-zinc-300"
                  onClick={() => onPickImage(null)}
                >
                  移除图片
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing || (!name.trim() && !imageFile)}
            className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-[#0c0f14] transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {analyzing ? "分析中…" : "分析产品（识图 + 联网检索 + 卖点/受众）"}
          </button>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {product && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#131820] p-6">
          <h2 className="text-lg font-semibold text-white">2. 分析结果</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs uppercase text-zinc-500">卖点</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-zinc-300">
                {selling.map((s, i) => (
                  <li key={`sp-${i}-${String(s).slice(0, 20)}`}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase text-zinc-500">受众</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-zinc-300">
                {audiences.map((s, i) => (
                  <li key={`au-${i}-${String(s).slice(0, 20)}`}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <h3 className="text-xs uppercase text-zinc-500">匹配关键词</h3>
            <p className="mt-1 text-sm text-cyan-200/90">{kws.length ? kws.join("、") : "—"}</p>
          </div>
          <p className="text-sm leading-relaxed text-zinc-400">
            {product.researchSummary || "—"}
          </p>

          {product.visionSummary && (
            <div>
              <h3 className="text-xs uppercase text-zinc-500">图片识别</h3>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-black/25 p-3 text-sm text-zinc-300">
                {product.visionSummary}
              </pre>
            </div>
          )}
          {product.webSearchSummary && (
            <div>
              <h3 className="text-xs uppercase text-zinc-500">联网检索</h3>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/25 p-3 text-sm text-zinc-300">
                {product.webSearchSummary}
              </pre>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-zinc-300">热点库匹配（Top）</h3>
            {matches.length === 0 ? (
              <p className="mt-2 text-sm text-amber-200/80">
                当前无足够匹配的热点，可尝试先同步热点库或改用「独立编撰脚本」。
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {matches.map((m) => (
                  <li
                    key={m.hotspot.id}
                    className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <span className="text-cyan-400/90">[{m.score} 分]</span>{" "}
                    {m.hotspot.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => genScript(false)}
              disabled={generating}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-[#0c0f14] hover:bg-cyan-400 disabled:opacity-50"
            >
              {generating ? "生成中…" : "按匹配热点生成脚本"}
            </button>
            <button
              type="button"
              onClick={() => genScript(true)}
              disabled={generating}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-50"
            >
              独立编撰（无热点绑定）
            </button>
          </div>
        </section>
      )}

      {script && (
        <section className="space-y-4 rounded-2xl border border-cyan-500/20 bg-[#131820] p-6">
          <h2 className="text-lg font-semibold text-white">3. 生成脚本</h2>
          <p className="text-xs text-zinc-500">
            模式：{script.mode === "matched" ? "热点融合" : "独立编撰"} · 关联热点数：{" "}
            {matchedHotspots.length}
          </p>
          <div>
            <h3 className="text-sm font-medium text-zinc-400">分镜大纲</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-zinc-300">
              {(script.outline ?? []).map((o, i) => (
                <li key={`ol-${script.id}-${i}`}>{o}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-400">正文</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-4 text-sm leading-relaxed text-zinc-200">
              {script.content ?? ""}
            </pre>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#131820] p-6">
          <h2 className="text-lg font-semibold text-white">最近生成</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            {history.slice(0, 5).map((s) => {
              const preview = String(s.content ?? "").slice(0, 60);
              const when = s.createdAt ? s.createdAt.slice(0, 19) : "—";
              return (
                <li key={s.id} className="border-b border-white/5 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScript(s);
                      setMatchedHotspots([]);
                    }}
                    className="w-full truncate text-left hover:text-zinc-200"
                    title="点击查看详情"
                  >
                    {when} · {s.mode} · {preview}
                    {preview.length >= 60 ? "…" : ""}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ScriptsClient() {
  return (
    <ClientErrorBoundary>
      <ScriptsInner />
    </ClientErrorBoundary>
  );
}
