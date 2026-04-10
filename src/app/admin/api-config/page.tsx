"use client";

import { useEffect, useState } from "react";
import { ApiKeyManager } from "@/components/ApiKeyManager";

type MeRes =
  | { ok: true; user: { username: string; role: "admin" | "user" } }
  | { ok: false; error: string };

export default function AdminApiConfigPage() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"admin" | "user" | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const j = (await r.json()) as MeRes;
        if (!alive) return;
        if (r.ok && j.ok) setRole(j.user.role);
        else setRole(null);
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

  if (!ready) return <div className="text-zinc-500">加载中…</div>;
  if (role !== "admin") {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#131820] p-6 text-sm text-zinc-300">
        只有管理员可进入此页面。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">API 配置</h1>
      <ApiKeyManager />
    </div>
  );
}

