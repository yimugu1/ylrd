import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "daima_auth_token";
const AUTH_SECRET_FALLBACK = "ylrd-public-fallback-secret-v1";

function base64urlToBase64(input: string): string {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  return s.padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function base64urlFromArrayBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlUtf8(input: string): string {
  const bin = atob(base64urlToBase64(input));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function isTokenValid(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const expected = base64urlFromArrayBuffer(signed);
  if (!constantTimeEqual(sig, expected)) return false;

  try {
    const json = decodeBase64UrlUtf8(payloadB64);
    const parsed = JSON.parse(json) as { exp?: number };
    return Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/login")) return NextResponse.next();
  if (pathname.startsWith("/api")) return NextResponse.next();

  const secret = process.env.AUTH_SECRET?.trim() || AUTH_SECRET_FALLBACK;
  const token = request.cookies.get(COOKIE_NAME)?.value ?? "";

  const ok = !!token && (await isTokenValid(token, secret));
  if (ok) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const next = pathname + (search || "");
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

