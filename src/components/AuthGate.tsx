"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MeRes =
  | { ok: true; user: { username: string; role: "admin" | "user" } }
  | { ok: false; error: string };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPath = pathname?.startsWith("/login") ?? false;

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!pathname) return;

    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const j = (await r.json()) as MeRes;
        if (!alive) return;
        if (r.ok && j.ok) {
          setAuthed(true);
          if (isLoginPath) {
            router.replace("/");
            return;
          }
        } else {
          if (isLoginPath) {
            setAuthed(true);
            return;
          }
          setAuthed(false);
        }
      } catch {
        if (!alive) return;
        if (isLoginPath) {
          setAuthed(true);
          return;
        }
        setAuthed(false);
      } finally {
        if (!alive) return;
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isLoginPath, pathname, router]);

  useEffect(() => {
    if (!ready) return;
    if (isLoginPath) return;
    if (authed) return;
    const next = encodeURIComponent(pathname);
    router.replace(`/login?next=${next}`);
  }, [authed, isLoginPath, pathname, ready, router]);

  if (!ready) {
    return <div className="text-zinc-500">加载中…</div>;
  }

  if (!authed && !isLoginPath) return null;
  return <>{children}</>;
}

