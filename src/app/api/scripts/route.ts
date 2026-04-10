import { NextResponse } from "next/server";
import { readData } from "@/lib/store";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = requireAuth();
  if (!("role" in auth)) return auth;
  const data = await readData();
  const mine = data.scripts.filter((s) => s.createdBy === auth.username);
  return NextResponse.json({ scripts: mine.slice(0, 50) });
}
