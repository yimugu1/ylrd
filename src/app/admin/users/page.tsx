"use client";

import { useEffect, useState } from "react";

type MeRes =
  | { ok: true; user: { username: string; role: "admin" | "user" } }
  | { ok: false; error: string };

type UserItem = {
  id: string;
  username: string;
  password: string;
  role: "admin" | "user";
  createdAt: string;
};

export default function AdminUsersPage() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await r.json()) as MeRes;
        if (!alive) return;
        if (r.ok && j.ok) {
          setRole(j.user.role);
        } else {
          setRole(null);
        }
      } catch {
        if (!alive) return;
        setRole(null);
      } finally {
        if (!alive) return;
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || role !== "admin") return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/users", { credentials: "include" });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        setUsers(Array.isArray(j.users) ? (j.users as UserItem[]) : []);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, role]);

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
      const j = (await r.json()) as { ok?: boolean; error?: string; user?: UserItem };
      if (!r.ok) {
        setMsg(j.error || "创建失败");
        return;
      }
      setMsg("已创建用户。");
      setUsername("");
      setPassword("");
      // refresh list
      const r2 = await fetch("/api/auth/users", { credentials: "include", cache: "no-store" });
      if (r2.ok) {
        const j2 = await r2.json();
        setUsers(Array.isArray(j2.users) ? (j2.users as UserItem[]) : []);
      }
    } catch {
      setMsg("网络错误：创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editingId,
          username: editUsername,
          password: editPassword,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) {
        setMsg(j.error || "修改失败");
        return;
      }
      setMsg("修改成功。");
      setEditingId(null);
      setEditUsername("");
      setEditPassword("");
      const r2 = await fetch("/api/auth/users", { credentials: "include", cache: "no-store" });
      if (r2.ok) {
        const j2 = await r2.json();
        setUsers(Array.isArray(j2.users) ? (j2.users as UserItem[]) : []);
      }
    } catch {
      setMsg("网络错误：修改失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">用户管理</h1>
        <p className="mt-1 text-sm text-zinc-400">
          只能管理员创建新用户；普通账号只能使用功能。
        </p>
      </div>

      {ready && role !== "admin" && (
        <div className="rounded-2xl border border-white/10 bg-[#131820] p-6 text-sm text-zinc-300">
          只有管理员可进入此页面。
        </div>
      )}

      {ready && role === "admin" && (
        <>
          <section className="rounded-2xl border border-white/10 bg-[#131820] p-6">
            <h2 className="text-lg font-semibold text-white">创建新用户</h2>
            <div className="mt-4 space-y-4">
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
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#131820] p-6">
            <h2 className="text-lg font-semibold text-white">当前用户</h2>
            <div className="mt-3 text-sm text-zinc-300">
              {users.length === 0 ? (
                <div className="text-zinc-500">暂无用户</div>
              ) : (
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li key={u.id} className="space-y-2 border-b border-white/5 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">
                          账号：{u.username}（{u.role}）
                        </span>
                        <span className="text-xs text-zinc-500">{u.createdAt.slice(0, 10)}</span>
                      </div>
                      <div className="text-zinc-400">密码：{u.password}</div>
                      <button
                        type="button"
                        className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/5"
                        onClick={() => {
                          setEditingId(u.id);
                          setEditUsername(u.username);
                          setEditPassword(u.password);
                          setMsg(null);
                        }}
                      >
                        修改账号/密码
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {editingId && (
            <section className="rounded-2xl border border-white/10 bg-[#131820] p-6">
              <h2 className="text-lg font-semibold text-white">修改用户信息</h2>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm text-zinc-400">账号</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-zinc-400">密码</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0f14] px-3 py-2 text-white"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={saving || !editUsername.trim() || !editPassword.trim()}
                    onClick={saveEdit}
                    className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-[#0c0f14] hover:bg-cyan-400 disabled:opacity-50"
                  >
                    保存修改
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditUsername("");
                      setEditPassword("");
                    }}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    取消
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

