import { NextResponse } from "next/server";
import { getMePublic } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = await getMePublic();
  if ("error" in res) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user: res.user });
}

