import { randomUUID } from "crypto";
import type { Hotspot } from "./types";
import { fetchHotspotsFromRss } from "./rss-sync";

const CHINESE_RE = /[\u4e00-\u9fff]/;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function unique(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function extractEntertainmentTags(text: string): string[] {
  const t = text;
  const candidates: Array<[string, RegExp]> = [
    ["明星", /明星|偶像/],
    ["影视剧", /电视剧|电影|剧|主演|阵容|官宣|新片/],
    ["综艺", /综艺|真人秀|五哈|乘风|挑战/],
    ["音乐", /歌曲|歌手|音乐|演唱会|新歌|MV|原声/],
    ["游戏", /游戏|手游|联动|赛季爆料/],
    ["动漫", /动漫|动画|番剧|洛克王国/],
    ["美妆", /美妆|护肤|彩妆|成分/],
    ["穿搭", /穿搭|搭配|服饰|鞋子|少女|浅春|春日|氛围/],
    ["测评种草", /测评|种草|体验|对比|混剪|预告/],
    ["数码家电", /手机|iPhone|华为|平板|耳机|相机|电视|空调/],
    ["情感恋爱", /恋爱|分手|婚姻|暧昧|求婚|约会|甜度/],
    ["搞笑", /搞笑|爆笑|笑死|遛一下/],
    ["直播带货", /直播|带货|口播/],
    ["旅行", /旅行|拍照|出片|日落|海边|洱海|日照金山|海鸥/],
    ["美食", /美食|吃|教程|爆米花|馒头|奶香|下饭|甜度/],
    ["生活方式", /日常|超日常|温柔|治愈|温柔约会/],
  ];

  const tags: string[] = [];
  for (const [label, re] of candidates) {
    if (re.test(t)) tags.push(label);
  }

  return unique(tags).slice(0, 8);
}

function buildPlatformSearchUrl(platform: "douyin" | "xhs", q: string): string {
  const encoded = encodeURIComponent(q.slice(0, 60));
  if (platform === "douyin") {
    return `https://www.douyin.com/search/${encoded}`;
  }
  return `https://www.xiaohongshu.com/search?q=${encoded}`;
}

async function fetchHotspotsFromDouyinXhsByWeb(): Promise<Hotspot[]> {
  const now = new Date().toISOString();
  const out: Hotspot[] = [];
  // 1) 抖音热搜榜（免 key 文本榜单）
  try {
    const res = await fetch("https://api.suyanw.cn/api/douyinresou.php", {
      headers: {
        "User-Agent": "HotspotHub/1.0",
      },
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        // 形如：1：郑丽文将访问大陆
        const m = line.match(/^(\d+)[：:](.+)$/);
        if (!m) continue;
        const word = m[2].trim();
        if (!word || !CHINESE_RE.test(word)) continue;
        const tags = extractEntertainmentTags(word);
        if (tags.length === 0) continue;
        out.push({
          id: randomUUID(),
          title: stripHtml(word).slice(0, 60),
          summary: word.slice(0, 80),
          source: "抖音热搜榜",
          url: buildPlatformSearchUrl("douyin", word),
          publishedAt: now,
          fetchedAt: now,
          tags,
          channel: "social_style",
        });
        if (out.length >= 30) break;
      }
    }
  } catch {
    // ignore
  }

  // 2) 小红书热榜（免 key JSON）
  try {
    const res = await fetch("http://api.nonebot.top/api/v1/spider/hot/redbook", {
      headers: {
        "User-Agent": "HotspotHub/1.0",
      },
    });
    if (res.ok) {
      const j = (await res.json()) as {
        code?: number;
        data?: Array<{
          rank?: number;
          title?: string;
          link?: string;
          score?: string;
          word_type?: string;
        }>;
      };

      const list = Array.isArray(j.data) ? j.data : [];
      for (const it of list) {
        const title = stripHtml(String(it.title ?? "")).trim();
        if (!title || !CHINESE_RE.test(title)) continue;
        const link =
          String(it.link ?? "").trim() || buildPlatformSearchUrl("xhs", title);
        const tags = extractEntertainmentTags(title);
        if (tags.length === 0) continue;
        out.push({
          id: randomUUID(),
          title: title.slice(0, 60),
          summary: `${String(it.word_type ?? "").trim() || "热"} · ${String(
            it.score ?? ""
          ).trim()}`.slice(0, 120) || title.slice(0, 80),
          source: "小红书热榜",
          url: link,
          publishedAt: now,
          fetchedAt: now,
          tags,
          channel: "social_style",
        });
        if (out.length >= 50) break;
      }
    }
  } catch {
    // ignore
  }

  // 避免一次同步塞太多条目（上传/渲染会变慢）
  return out.slice(0, 50);
}

/**
 * 热点库同步：优先抓“抖音/小红书中文娱乐热榜”，失败则回退 RSS。
 */
export async function fetchHotspotsForSync(): Promise<Hotspot[]> {
  const social = await fetchHotspotsFromDouyinXhsByWeb();
  if (social.length > 0) return social;
  return fetchHotspotsFromRss();
}

