import fs from "fs/promises";
import path from "path";
import type { AppData, GeneratedScript, Hotspot, ProductAnalysis } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "app.json");

const empty: AppData = { hotspots: [], products: [], scripts: [] };

export async function readData(): Promise<AppData> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AppData;
    return {
      hotspots: parsed.hotspots ?? [],
      products: parsed.products ?? [],
      scripts: parsed.scripts ?? [],
    };
  } catch {
    return { ...empty };
  }
}

async function writeData(data: AppData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeHotspotTitleForDedup(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 社媒热榜：同一标题视为同一条，避免链接编码差异导致重复 */
function socialStyleDedupeKey(h: Hotspot): string | null {
  if (h.channel !== "social_style") return null;
  return `social_style:${normalizeHotspotTitleForDedup(h.title)}`;
}

export async function upsertHotspots(items: Hotspot[]): Promise<number> {
  const data = await readData();
  const byUrl = new Map(data.hotspots.map((h) => [h.url, h]));
  const bySocialTitle = new Map<string, Hotspot>();
  for (const h of data.hotspots) {
    const sk = socialStyleDedupeKey(h);
    if (sk) bySocialTitle.set(sk, h);
  }
  let added = 0;
  for (const h of items) {
    if (byUrl.has(h.url)) continue;
    const sk = socialStyleDedupeKey(h);
    if (sk && bySocialTitle.has(sk)) continue;
    byUrl.set(h.url, h);
    if (sk) bySocialTitle.set(sk, h);
    added++;
  }
  data.hotspots = Array.from(byUrl.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  await writeData(data);
  return added;
}

export async function purgeHotspotsByChannel(channel: Hotspot["channel"]): Promise<void> {
  const data = await readData();
  const before = data.hotspots.length;
  data.hotspots = data.hotspots.filter((h) => h.channel !== channel);
  if (data.hotspots.length === before) return;
  await writeData(data);
}

export async function saveProduct(p: ProductAnalysis): Promise<void> {
  const data = await readData();
  data.products.unshift(p);
  await writeData(data);
}

export async function saveScript(s: GeneratedScript): Promise<void> {
  const data = await readData();
  data.scripts.unshift(s);
  await writeData(data);
}

export async function getHotspots(): Promise<Hotspot[]> {
  const data = await readData();
  return data.hotspots;
}

export async function getProduct(id: string): Promise<ProductAnalysis | undefined> {
  const data = await readData();
  return data.products.find((p) => p.id === id);
}
