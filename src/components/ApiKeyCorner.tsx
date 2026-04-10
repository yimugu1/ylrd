"use client";

import { useEffect, useState } from "react";
import { ApiKeyManager } from "@/components/ApiKeyManager";

export function ApiKeyCorner() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "user" | null>(null);

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let intervalId: number | null = null;

    async function refresh() {
      try {
        const r = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) {
          if (!stopped) setRole(null);
          return;
        }
        const j = (await r.json()) as { user?: { role?: "admin" | "user" } };
        const nextRole = j.user?.role ?? null;
        if (!stopped) setRole(nextRole);
        if (nextRole === "admin" && intervalId) {
          window.clearInterval(intervalId);
        }
      } catch {
        // ignore
      }
    }

    void refresh();
    intervalId = window.setInterval(() => {
      attempt++;
      if (stopped) {
        if (intervalId) window.clearInterval(intervalId);
        return;
      }
      // 覆盖“登录后未重载导致未重新取角色”的情况
      if (attempt >= 20) {
        if (intervalId) window.clearInterval(intervalId);
        return;
      }
      void refresh();
    }, 1500);

    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  if (role !== "admin") return null;

  return (
    <>
      {/* 固定右上角，但下移一段，避免挡住“脚本制作区”的顶部功能按钮 */}
      <div className="fixed right-4 top-[68px] z-[60]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-white/15 bg-[#131820]/80 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition hover:bg-[#131820]"
        >
          API 配置
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-4 top-[68px] w-[min(420px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#0c0f14] p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-2 pb-2">
              <div className="text-sm font-semibold text-white">API Key 配置</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/90 hover:bg-white/10"
              >
                关闭
              </button>
            </div>
            <ApiKeyManager />
          </div>
        </div>
      )}
    </>
  );
}

