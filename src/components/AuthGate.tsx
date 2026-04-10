"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MeRes =
  | { ok: true; user: { username: string; role: "admin" | "user" } }
  | { ok: false; error: string };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/login")) {
      setReady(true);
      setAuthed(true);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await r.json()) as MeRes;
        if (!alive) return;
        if (r.ok && j.ok) {
          setAuthed(true);
        } else {
          setAuthed(false);
        }
      } catch {
        if (!alive) return;
        setAuthed(false);
      } finally {
        if (!alive) return;
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (pathname.startsWith("/login")) return;
    if (authed) return;
    const next = encodeURIComponent(pathname);
    router.replace(`/login?next=${next}`);
  }, [authed, pathname, ready, router]);

  if (!ready) {
    return <div className="text-zinc-500">加载中…</div>;
  }

  if (!authed && !pathname.startsWith("/login")) return null;
  return <>{children}</>;
}

