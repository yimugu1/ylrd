/**
 * 默认 RSS 源（可经环境变量 RSS_FEED_URLS 覆盖，逗号分隔）。
 *
 * 说明：微博/抖音/小红书等「社媒热搜」几乎没有免费稳定公开 API；
 * 合规做法一般是购买平台官方数据服务，或自行在授权范围内采集。
 * 本列表以「资讯 + 科技 + 创投」类 RSS 近似「全网热点」话题池，便于脚本匹配。
 * 个别源若失效，请从列表中删掉或换源。
 */
export const DEFAULT_RSS_FEEDS = [
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://techcrunch.com/feed/",
  "https://www.theverge.com/rss/index.xml",
  "https://www.wired.com/feed/rss",
  "https://36kr.com/feed",
  "https://www.solidot.org/index.rss",
  "https://hnrss.org/frontpage",
];

export function getRssFeedList(): string[] {
  const env = process.env.RSS_FEED_URLS?.trim();
  if (env) {
    return env.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_RSS_FEEDS;
}
