import Parser from "rss-parser";
import { randomUUID } from "crypto";
import type { Hotspot } from "./types";
import { getRssFeedList } from "./rss-feeds";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "HotspotHub/1.0 (RSS reader)",
  },
});

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pickTags(categories: unknown): string[] {
  if (!categories || !Array.isArray(categories)) return [];
  return categories
    .map((c) => (typeof c === "string" ? c : (c as { _?: string })?._))
    .filter(Boolean)
    .slice(0, 8) as string[];
}

export async function fetchHotspotsFromRss(): Promise<Hotspot[]> {
  const feeds = getRssFeedList();
  const now = new Date().toISOString();
  const out: Hotspot[] = [];

  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      const sourceTitle = feed.title || new URL(url).hostname;
      const items = feed.items ?? [];
      for (const item of items.slice(0, 40)) {
        const title = stripHtml(item.title || "").slice(0, 200);
        if (!title) continue;
        const link = item.link || item.guid || "";
        if (!link) continue;
        const summary = stripHtml(
          item.contentSnippet || item.content || item.summary || ""
        ).slice(0, 500);
        const pub =
          item.pubDate || item.isoDate
            ? new Date(item.pubDate || item.isoDate || Date.now()).toISOString()
            : now;
        const tags = pickTags(item.categories);
        out.push({
          id: randomUUID(),
          title,
          summary,
          source: sourceTitle,
          url: link,
          publishedAt: pub,
          fetchedAt: now,
          tags,
          channel: "rss",
        });
      }
    } catch (e) {
      console.error(`RSS fetch failed: ${url}`, e);
    }
  }

  return out;
}
