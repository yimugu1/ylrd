import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SECRETS_PATH = path.join(DATA_DIR, "secrets.json");

type SecretsMap = Record<string, string>;

let cache: { mtimeMs: number; data: SecretsMap } | null = null;

function readSecretsSync(): SecretsMap {
  try {
    const stat = fs.statSync(SECRETS_PATH);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.data;
    const raw = fs.readFileSync(SECRETS_PATH, "utf-8");
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const data: SecretsMap = {};
    for (const [k, v] of Object.entries(parsed)) data[k] = String(v ?? "");
    cache = { mtimeMs: stat.mtimeMs, data };
    return data;
  } catch {
    cache = { mtimeMs: 0, data: {} };
    return {};
  }
}

export function getSecret(name: string): string {
  const secrets = readSecretsSync();
  const fromFile = Object.prototype.hasOwnProperty.call(secrets, name)
    ? String(secrets[name] ?? "")
    : "";
  const fromEnv = process.env[name] ?? "";
  const a = fromFile.trim();
  const b = String(fromEnv).trim();
  // 文件中若误存空字符串，仍可使用环境变量（避免 401 Missing Authentication）
  return a || b || "";
}

export function setSecrets(partial: Partial<SecretsMap>): SecretsMap {
  const secrets = readSecretsSync();
  const next: SecretsMap = { ...secrets };
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue;
    next[k] = String(v);
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRETS_PATH, JSON.stringify(next, null, 2), "utf-8");
  cache = null;
  return next;
}

export function getSecretsForClient(): {
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  OPENAI_VISION_MODEL: string;
  // keys 不返回真实值，避免泄露
  OPENAI_API_KEY: "";
  TAVILY_API_KEY: "";
} {
  return {
    OPENAI_BASE_URL: getSecret("OPENAI_BASE_URL") || "https://openrouter.ai/api/v1",
    OPENAI_MODEL: getSecret("OPENAI_MODEL") || "openrouter/free",
    OPENAI_VISION_MODEL:
      getSecret("OPENAI_VISION_MODEL") || getSecret("OPENAI_MODEL") || "openrouter/free",
    OPENAI_API_KEY: "",
    TAVILY_API_KEY: "",
  };
}

