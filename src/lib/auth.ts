import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adminUsers, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

const SECRET = process.env.SESSION_SECRET || "jays-dev-secret-change-me";

export type Role = "owner" | "attendant" | "rider";
export type Session = { uid: number; name: string; role: Role; riderId: number | null };

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const h = scryptSync(pw, salt, 32);
  const b = Buffer.from(hash, "hex");
  return b.length === h.length && timingSafeEqual(h, b);
}

export function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
}

export function signedValue(value: string) {
  return `${Buffer.from(value).toString("base64url")}.${sign(value)}`;
}

export function readSigned(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const [b, s] = raw.split(".");
  if (!b || !s) return null;
  const value = Buffer.from(b, "base64url").toString();
  return sign(value) === s ? value : null;
}

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.username, username.trim().toLowerCase()));
  const u = rows[0];
  if (!u || !u.active || !verifyPassword(password, u.passwordHash)) return false;
  const session: Session = { uid: u.id, name: u.name, role: u.role as Role, riderId: u.riderId };
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const jar = await cookies();
  jar.set("jays_admin", signedValue(JSON.stringify({ ...session, exp })), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const v = readSigned(jar.get("jays_admin")?.value);
  if (!v) return null;
  try {
    const s = JSON.parse(v) as Session & { exp: number };
    if (s.exp < Date.now()) return null;
    return { uid: s.uid, name: s.name, role: s.role, riderId: s.riderId };
  } catch {
    return null;
  }
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (!roles.includes(s.role)) redirect(s.role === "rider" ? "/admin/orders" : "/admin");
  return s;
}

export async function audit(user: string, action: string, entity: string, entityId?: string | number, detail?: string) {
  await db.insert(auditLogs).values({ userName: user, action, entity, entityId: entityId?.toString(), detail });
}

export async function logoutAdmin() {
  const jar = await cookies();
  jar.delete("jays_admin");
}
