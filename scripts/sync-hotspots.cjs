/**
 * 调用本机或线上站点的「定时同步热点」接口（需 Next 服务已启动）。
 * 用法：npm run sync:hotspots
 * 可选环境变量：SYNC_BASE_URL（默认 http://127.0.0.1:3000）、CRON_SECRET（与 .env.local 一致）
 */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const root = path.join(__dirname, "..");
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

async function main() {
  loadEnv();
  const base = (process.env.SYNC_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );
  const secret = process.env.CRON_SECRET?.trim();
  /** @type {Record<string, string>} */
  const headers = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const url = `${base}/api/cron/sync-hotspots`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  const res = await fetch(url, { headers, signal: ctrl.signal }).finally(() =>
    clearTimeout(t)
  );
  const body = await res.text();
  console.log(body);
  if (!res.ok) {
    console.error("HTTP", res.status);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
