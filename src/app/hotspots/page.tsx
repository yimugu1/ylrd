"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Hotspot = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  tags: string[];
  channel: string;
};

/** 不用 date-fns，避免客户端分包加载异常；与 parseISO+本地日期等价 */
function dateKeyFromPublished(iso: string | undefined): string {
  if (!iso) return "未知日期";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未知日期";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeHotspot(raw: Record<string, unknown>): Hotspot | null {
  const id = String(raw.id ?? "");
  const title = String(raw.title ?? "");
  if (!id || !title) return null;
  const tagsRaw = raw.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => String(t))
    : [];
  return {
    id,
    title,
    summary: String(raw.summary ?? ""),
    source: String(raw.source ?? ""),
    url: String(raw.url ?? "#"),
    publishedAt: String(raw.publishedAt ?? ""),
    fetchedAt: String(raw.fetchedAt ?? ""),
    tags,
    channel: String(raw.channel ?? "rss"),
  };
}

function timeMs(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function groupByDate(items: Hotspot[]): Map<string, Hotspot[]> {
  const groups = new Map<string, Hotspot[]>();
  for (const h of items) {
    const key = dateKeyFromPublished(h.publishedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(h);
  }
  for (const arr of Array.from(groups.values())) {
    arr.sort((a, b) => {
      const byPub = timeMs(b.publishedAt) - timeMs(a.publishedAt);
      if (byPub !== 0) return byPub;
      return timeMs(b.fetchedAt) - timeMs(a.fetchedAt);
    });
  }
  return new Map(
    Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  );
}

export default function HotspotsPage() {
  const [list, setList] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/hotspots");
      const j = await r.json();
      const raw = Array.isArray(j.hotspots) ? j.hotspots : [];
      setList(
        raw
          .map((x: Record<string, unknown>) => normalizeHotspot(x))
          .filter((x: Hotspot | null): x is Hotspot => x !== null)
      );
    } catch {
      setMsg("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => groupByDate(list), [list]);

  async function sync() {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await fetch("/api/hotspots/sync", { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        const skip =
          typeof j.skipped === "number" && j.skipped > 0
            ? `，已有 ${j.skipped} 条未重复写入`
            : "";
        setMsg(
          `同步完成：新增 ${j.added} 条（本次抓取 ${j.fetched} 条${skip}）`
        );
        await load();
      } else {
        setMsg(j.error || "同步失败");
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">热点库</h1>
          <p className="mt-1 text-sm text-zinc-400">
            历史同步结果会保留，按日期与时间从新到旧排列；已入库的链接或同标题社媒条目不会重复添加。优先抓取中文社媒热榜，失败时回退 RSS。
          </p>
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-[#0c0f14] transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {syncing ? "同步中…" : "同步热点"}
        </button>
      </div>

      {msg && (
        <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          {msg}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500">加载中…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#131820] p-10 text-center text-zinc-300">
          暂无数据。请先点击「同步热点」，或配置每日任务请求{" "}
          <code className="text-cyan-200/90">/api/cron/sync-hotspots</code>。
        </div>
      ) : (
        <div className="space-y-10">
          {Array.from(grouped.entries()).map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-200">
                <span className="h-px flex-1 bg-white/10" />
                {date}
                <span className="h-px flex-1 bg-white/10" />
              </h2>
              <ul className="space-y-3">
                {items.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-xl border border-white/10 bg-[#131820] p-4 transition hover:border-white/20"
                  >
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-medium text-white hover:text-cyan-300"
                    >
                      {h.title}
                    </a>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{h.summary}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>{h.source}</span>
                      {(h.tags ?? []).slice(0, 4).map((t, ti) => (
                        <span
                          key={`${h.id}-tag-${ti}`}
                          className="rounded bg-white/5 px-2 py-0.5 text-zinc-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
