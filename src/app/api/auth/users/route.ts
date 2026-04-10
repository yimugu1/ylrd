import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createUser, getUsersPublic, updateUserCredentials } from "@/lib/auth-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
const updateSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function GET() {
  const auth = requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const users = await getUsersPublic();
  return NextResponse.json({ ok: true, users });
}

export async function POST(request: Request) {
  const auth = requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "参数错误" },
      { status: 400 }
    );
  }

  try {
    const created = await createUser({
      username: parsed.data.username,
      password: parsed.data.password,
      role: "user",
    });
    return NextResponse.json({ ok: true, user: created });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "创建失败" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "参数错误" },
      { status: 400 }
    );
  }
  try {
    const user = await updateUserCredentials(parsed.data);
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "修改失败" },
      { status: 400 }
    );
  }
}

