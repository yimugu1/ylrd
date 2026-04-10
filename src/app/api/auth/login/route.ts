import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginAndGetToken } from "@/lib/auth";
import { ensureAuthUsers, ensureBootstrapAdminUser } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const username = String(json?.username ?? "");
  const password = String(json?.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }

  try {
    // 首次启动时尝试用 env 初始化管理员（仅当 users.json 不存在时）
    await ensureAuthUsers();
    // 部署兜底：确保 env 中声明的管理员账号始终可用
    await ensureBootstrapAdminUser();
  } catch {
    return NextResponse.json(
      { ok: false, error: "账号初始化失败，请检查服务端 data 目录写权限" },
      { status: 500 }
    );
  }

  const token = await loginAndGetToken(username, password);
  if (!token) {
    return NextResponse.json({ ok: false, error: "用户名或密码错误" }, { status: 401 });
  }

  cookies().set("daima_auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true });
}

