import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { UserRole } from "./auth-store";
import { getUserPublic, verifyUserCredentials } from "./auth-store";

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
};

const COOKIE_NAME = "daima_auth_token";

type TokenPayload = {
  uid: string;
  u: string;
  r: UserRole;
  exp: number; // ms
};

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signPayload(payloadBase64Url: string): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    // 没配 secret，直接视为无效（避免绕过鉴权）
    return "";
  }
  const h = crypto.createHmac("sha256", secret).update(payloadBase64Url).digest();
  return base64url(h);
}

function verifyToken(token: string): AuthUser | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expected = signPayload(payloadB64);
  if (!expected || sig.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }

  let parsed: TokenPayload;
  try {
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf-8");
    parsed = JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }

  if (!parsed.exp || parsed.exp < Date.now()) return null;
  if (!parsed.uid || !parsed.u || !parsed.r) return null;

  return { id: parsed.uid, username: parsed.u, role: parsed.r };
}

export function createAuthToken(user: AuthUser): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload: TokenPayload = { uid: user.id, u: user.username, r: user.role, exp };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function getAuthUserOrNull(): AuthUser | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function requireAuth(): NextResponse | AuthUser {
  const u = getAuthUserOrNull();
  if (!u) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return u;
}

export function requireAdmin(): NextResponse | AuthUser {
  const u = getAuthUserOrNull();
  if (!u) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (u.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return u;
}

export async function loginAndGetToken(username: string, password: string) {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;

  const user = await verifyUserCredentials(username, password);
  if (!user) return null;
  // 只用 token payload + 签名即可，不必每次都查用户文件
  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  return createAuthToken(authUser);
}

// 供 UI 使用：确保用户名存在且角色能返回（不返回密码）
export async function getMePublic(): Promise<{ user: AuthUser } | { error: string }> {
  const u = getAuthUserOrNull();
  if (!u) return { error: "Unauthorized" };
  const pub = await getUserPublic(u.username);
  if (!pub) return { error: "User not found" };
  return { user: { id: pub.id, username: pub.username, role: pub.role } };
}

