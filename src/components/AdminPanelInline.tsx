"use client";

import { useEffect, useState } from "react";

type MeRes =
  | { ok: true; user: { username: string; role: "admin" | "user" } }
  | { ok: false; error: string };

type UserItem = {
  id: string;
  username: string;
  role: "admin" | "user";
  createdAt: string;
};

export function AdminPanelInline() {
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadMe() {
    const r = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
    const j = (await r.json()) as MeRes;
    if (r.ok && j.ok) {
      setRole(j.user.role);
      return true;
    }
    setRole(null);
    return false;
  }

  async function loadUsersIfAdmin() {
    if (role !== "admin") return;
    const r = await fetch("/api/auth/users", {
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return;
    const j = (await r.json()) as { ok?: boolean; users?: unknown };
    setUsers(Array.isArray(j.users) ? (j.users as UserItem[]) : []);
  }

  useEffect(() => {
    let attempts = 0;
    let intervalId: number | null = null;
    const refresh = async () => {
      const ok = await loadMe();
      if (ok && role === "admin") {
        await loadUsersIfAdmin();
        if (intervalId) window.clearInterval(intervalId);
      }
      // role 可能是异步更新导致判断失准，所以后面由 role effect兜底加载 users
    };

    void refresh();
    intervalId = window.setInterval(() => {
      attempts++;
      if (attempts >= 20) {
        if (intervalId) window.clearInterval(intervalId);
        return;
      }
      void refresh();
    }, 1500);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    void loadUsersIfAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function createUser() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j.error || "创建失败");
        return;
      }
      setMsg("已创建用户。");
      setUsername("");
      setPassword("");
      await loadUsersIfAdmin();
    } catch {
      setMsg("网络错误：创建失败");
    } finally {
      setSaving(false);
    }
  }

  if (role !== "admin") return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#131820] p-6">
      <h2 className="text-lg font-semibold text-white">管理员：创建新用户</h2>
      <p className="mt-1 text-sm text-zinc-400">
        只有管理员可以创建账号，普通用户只能登录后使用。
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm text-zinc-400">账号</span>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例如：user1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">密码（至少 6 位）</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />
        </label>

        {msg && (
          <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
            {msg}
          </p>
        )}

        <button
          type="button"
          disabled={saving || !username.trim() || !password.trim()}
          onClick={createUser}
          className="w-full rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-[#0c0f14] transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {saving ? "创建中…" : "创建并授予使用权限"}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-zinc-200">当前用户</h3>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          {users.length === 0 ? (
            <li className="text-zinc-500">暂无用户</li>
          ) : (
            users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
                <span className="truncate">
                  {u.username} ({u.role})
                </span>
                <span className="text-xs text-zinc-500">{u.createdAt.slice(0, 10)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

