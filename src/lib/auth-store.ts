import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type UserRole = "admin" | "user";

export type StoredUser = {
  id: string;
  username: string;
  salt: string;
  passwordHash: string;
  passwordPlain?: string;
  role: UserRole;
  createdAt: string;
};

const USERS_PATH = path.join(process.cwd(), "data", "users.json");

export type PublicUser = {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  createdAt: string;
};

function normalizeUsername(username: string): string {
  return String(username ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function pbkdf2Hash(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 310_000, 32, "sha256")
    .toString("base64");
}

export async function ensureAuthUsers(): Promise<void> {
  try {
    await fs.access(USERS_PATH);
    return;
  } catch {
    // continue
  }

  const adminUsername = process.env.AUTH_ADMIN_USERNAME?.trim();
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD?.trim();
  if (!adminUsername || !adminPassword) return;

  const salt = crypto.randomBytes(16).toString("base64");
  const admin: StoredUser = {
    id: crypto.randomUUID(),
    username: normalizeUsername(adminUsername),
    salt,
    passwordHash: pbkdf2Hash(adminPassword, salt),
    passwordPlain: adminPassword,
    role: "admin",
    createdAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(USERS_PATH), { recursive: true });
  await fs.writeFile(USERS_PATH, JSON.stringify([admin], null, 2), "utf-8");
}

/**
 * 生产部署兜底：只要配置了 AUTH_ADMIN_USERNAME/AUTH_ADMIN_PASSWORD，
 * 就确保该管理员账号可登录（不存在则创建，存在则校准为最新密码与 admin 角色）。
 */
export async function ensureBootstrapAdminUser(): Promise<void> {
  const adminUsername = normalizeUsername(process.env.AUTH_ADMIN_USERNAME?.trim() ?? "");
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD?.trim();
  if (!adminUsername || !adminPassword) return;

  const users = await readUsers();
  const idx = users.findIndex((u) => u.username === adminUsername);

  const salt = crypto.randomBytes(16).toString("base64");
  const adminPatch: Omit<StoredUser, "id" | "createdAt"> = {
    username: adminUsername,
    salt,
    passwordHash: pbkdf2Hash(adminPassword, salt),
    passwordPlain: adminPassword,
    role: "admin",
  };

  if (idx < 0) {
    users.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...adminPatch,
    });
  } else {
    users[idx] = {
      ...users[idx],
      ...adminPatch,
      role: "admin",
    };
  }

  await writeUsers(users);
}

async function readUsers(): Promise<StoredUser[]> {
  await ensureAuthUsers();
  const raw = await fs.readFile(USERS_PATH, "utf-8").catch(() => "[]");
  const parsed = JSON.parse(raw) as StoredUser[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await fs.mkdir(path.dirname(USERS_PATH), { recursive: true });
  await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
}

export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<StoredUser | null> {
  const u = normalizeUsername(username);
  if (!u || !password) return null;

  const users = await readUsers();
  const found = users.find((x) => x.username === u);
  if (!found) return null;

  const hashed = pbkdf2Hash(password, found.salt);
  const a = Buffer.from(hashed);
  const b = Buffer.from(found.passwordHash);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return found;
}

export async function getUserPublic(username: string): Promise<PublicUser | null> {
  const u = normalizeUsername(username);
  if (!u) return null;
  const users = await readUsers();
  const found = users.find((x) => x.username === u);
  if (!found) return null;
  const { id, role, createdAt } = found;
  return {
    id,
    username: found.username,
    password: found.passwordPlain || "******",
    role,
    createdAt,
  };
}

export async function getUsersPublic(): Promise<PublicUser[]> {
  const users = await readUsers();
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    password: u.passwordPlain || "******",
    role: u.role,
    createdAt: u.createdAt,
  }));
}

export async function createUser(params: {
  username: string;
  password: string;
  role: UserRole;
}): Promise<PublicUser> {
  const username = normalizeUsername(params.username);
  const password = String(params.password ?? "");

  if (!username) throw new Error("用户名不能为空");
  if (!password || password.length < 6) throw new Error("密码至少 6 位");

  // 限制用户名字符，避免奇怪输入
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5.-]+$/.test(username)) {
    throw new Error("用户名仅支持字母数字、下划线、中文、点号、短横线");
  }

  const users = await readUsers();
  if (users.some((u) => u.username === username)) throw new Error("用户名已存在");

  const salt = crypto.randomBytes(16).toString("base64");
  const passwordHash = pbkdf2Hash(password, salt);

  const created: StoredUser = {
    id: crypto.randomUUID(),
    username,
    salt,
    passwordHash,
    passwordPlain: password,
    role: params.role,
    createdAt: new Date().toISOString(),
  };

  users.push(created);
  await writeUsers(users);
  const { id, role, createdAt } = created;
  return {
    id,
    username: created.username,
    password: created.passwordPlain || "******",
    role,
    createdAt,
  };
}

export async function updateUserCredentials(params: {
  id: string;
  username: string;
  password: string;
}): Promise<PublicUser> {
  const id = String(params.id ?? "").trim();
  const username = normalizeUsername(params.username);
  const password = String(params.password ?? "");

  if (!id) throw new Error("用户 ID 不能为空");
  if (!username) throw new Error("用户名不能为空");
  if (!password || password.length < 6) throw new Error("密码至少 6 位");
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5.-]+$/.test(username)) {
    throw new Error("用户名仅支持字母数字、下划线、中文、点号、短横线");
  }

  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("用户不存在");

  if (users.some((u, i) => i !== idx && u.username === username)) {
    throw new Error("用户名已存在");
  }

  const salt = crypto.randomBytes(16).toString("base64");
  users[idx] = {
    ...users[idx],
    username,
    salt,
    passwordHash: pbkdf2Hash(password, salt),
    passwordPlain: password,
  };

  await writeUsers(users);
  const u = users[idx];
  return {
    id: u.id,
    username: u.username,
    password: u.passwordPlain || "******",
    role: u.role,
    createdAt: u.createdAt,
  };
}

