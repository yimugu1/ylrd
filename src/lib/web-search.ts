import { getSecret } from "./secrets";

/**
 * Tavily 联网检索：https://tavily.com
 * 环境变量 TAVILY_API_KEY 未配置时返回空字符串（由上层提示用户）。
 */
export async function searchProductOnWeb(query: string): Promise<string> {
  const key = getSecret("TAVILY_API_KEY")?.trim();
  if (!key || !query.trim()) return "";

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: query.slice(0, 400),
      search_depth: "advanced",
      max_results: 6,
      include_answer: true,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`联网检索失败 (${res.status}): ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: { title?: string; url?: string; content?: string }[];
  };

  const parts: string[] = [];
  if (data.answer) parts.push(`概述：${data.answer}`);
  if (data.results?.length) {
    for (const r of data.results.slice(0, 5)) {
      const line = [r.title, r.content?.slice(0, 280)].filter(Boolean).join(" — ");
      if (line) parts.push(`· ${line}`);
    }
  }
  return parts.join("\n");
}

/**
 * 围绕识图结果做多轮 Tavily 查询：通用信息 + 卖点/评测 + 受众人群，合并为一段供 AI 消化。
 */
export async function searchProductWebEnriched(
  primaryQuery: string,
  extraQueries: string[] = []
): Promise<string> {
  const key = getSecret("TAVILY_API_KEY")?.trim();
  if (!key || !primaryQuery.trim()) return "";

  const base = primaryQuery.trim().slice(0, 200);
  const uniq = Array.from(
    new Set(
      [
        base,
        `${base} 卖点 评测 参数`,
        `${base} 目标用户 适合人群 受众`,
        ...extraQueries.map((q) => q.trim().slice(0, 200)).filter(Boolean),
      ].filter(Boolean)
    )
  ).slice(0, 3);

  const blocks: string[] = [];
  for (const q of uniq) {
    const block = await searchProductOnWeb(q);
    if (block) blocks.push(`【检索：${q.slice(0, 80)}】\n${block}`);
  }
  return blocks.join("\n\n");
}
