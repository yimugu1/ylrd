import type { Hotspot } from "./types";

function normalize(s: string): string {
  return s.toLowerCase();
}

/** 简单中英文分词：连续中文、英文单词、数字 */
function tokens(text: string): string[] {
  const raw = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}|\d+/g) || [];
  return raw.map((t) => normalize(t));
}

export function scoreHotspot(
  hotspot: Hotspot,
  keywords: string[],
  sellingPoints: string[]
): number {
  const blob = [hotspot.title, hotspot.summary, ...hotspot.tags, ...sellingPoints].join(
    " "
  );
  const hsTokens = new Set(tokens(blob));
  let score = 0;
  for (const kw of keywords) {
    const k = normalize(kw.trim());
    if (k.length < 2) continue;
    if (blob.includes(kw) || blob.toLowerCase().includes(k)) score += 3;
    for (const t of tokens(kw)) {
      if (hsTokens.has(t)) score += 2;
    }
  }
  return score;
}

export function rankHotspots(
  hotspots: Hotspot[],
  keywords: string[],
  sellingPoints: string[],
  topN: number
): { hotspot: Hotspot; score: number }[] {
  const ranked = hotspots
    .map((h) => ({
      hotspot: h,
      score: scoreHotspot(h, keywords, sellingPoints),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, topN);
}
