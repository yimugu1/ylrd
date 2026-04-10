"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminToolsCorner() {
  const [role, setRole] = useState<"admin" | "user" | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (!r.ok) {
          if (alive) setRole(null);
          return;
        }
        const j = (await r.json()) as { user?: { role?: "admin" | "user" } };
        if (alive) setRole(j.user?.role ?? null);
      } catch {
        if (alive) setRole(null);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (role !== "admin") return null;

  return (
    <div className="fixed right-4 top-[68px] z-[60] flex flex-col gap-2">
      <Link
        href="/admin/users"
        className="rounded-xl border border-white/15 bg-[#131820]/85 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition hover:bg-[#131820]"
      >
        用户管理
      </Link>
      <Link
        href="/admin/api-config"
        className="rounded-xl border border-white/15 bg-[#131820]/85 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition hover:bg-[#131820]"
      >
        API 配置
      </Link>
    </div>
  );
}

