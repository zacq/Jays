import { cookies } from "next/headers";
import { readSigned } from "@/lib/auth";

export type Source = { c?: string; q?: string; u?: string; p?: string };

export async function readSource(): Promise<Source> {
  const jar = await cookies();
  const raw = jar.get("jays_src")?.value;
  if (!raw) return {};
  for (const v of [raw, safeDecode(raw)]) {
    try {
      const o = JSON.parse(v) as Source;
      return { c: str(o.c), q: str(o.q), u: str(o.u), p: str(o.p) };
    } catch {
      /* try next */
    }
  }
  return {};
}

const str = (x: unknown) => (typeof x === "string" ? x.slice(0, 60) : undefined);
function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function verifiedPhone(): Promise<string | null> {
  const jar = await cookies();
  return readSigned(jar.get("jays_phone")?.value);
}
