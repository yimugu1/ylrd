"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const links = [
  { href: "/", label: "首页" },
  { href: "/hotspots", label: "热点库" },
  { href: "/scripts", label: "脚本制作" },
];

export function Nav() {
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

  const navLinks = useMemo(() => {
    if (role !== "admin") return links;
    return [
      ...links,
      { href: "/admin/users", label: "用户管理" },
      { href: "/admin/api-config", label: "API 配置" },
    ];
  }, [role]);

  return (
    <header className="border-b border-white/10 bg-[#0c0f14]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-cyan-400">
          引力内部热点脚本工作台
        </Link>
        <nav className="flex flex-wrap gap-1 sm:gap-2">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
