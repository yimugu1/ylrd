export interface Hotspot {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  tags: string[];
  /** 来源类型：RSS 聚合、社媒风格标签等 */
  channel: "rss" | "social_style";
}

export interface ProductAnalysis {
  id: string;
  name: string;
  rawDescription: string;
  sellingPoints: string[];
  audience: string[];
  keywords: string[];
  /** 无联网 API 时为模型推断说明 */
  researchSummary: string;
  createdAt: string;
  /** 图片识别摘要（型号、外观特征等） */
  visionSummary?: string;
  /** 联网检索到的型号/参数等摘要 */
  webSearchSummary?: string;
}

export interface GeneratedScript {
  id: string;
  createdBy: string;
  productId: string;
  matchedHotspotIds: string[];
  content: string;
  outline: string[];
  createdAt: string;
  mode: "matched" | "standalone";
}

export interface AppData {
  hotspots: Hotspot[];
  products: ProductAnalysis[];
  scripts: GeneratedScript[];
}
