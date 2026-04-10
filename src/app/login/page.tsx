"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const nextSafe = useMemo(() => {
    // 简单防护：只允许站内路径
    if (next.startsWith("/") && !next.startsWith("//")) return next;
    return "/";
  }, [next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) {
        setMsg(j.error || "登录失败");
        return;
      }
      router.replace(nextSafe);
    } catch {
      setMsg("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/10 bg-[#131820] p-6">
        <h1 className="text-xl font-semibold text-white">登录</h1>
        <p className="mt-2 text-sm text-zinc-400">
          请输入账号、密码开始使用。
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm text-zinc-400">账号</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如：admin"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">密码</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </label>

          {msg && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-[#0c0f14] transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}

