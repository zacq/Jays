export const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString("en-KE")}`;

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/[\s-]/g, "");
  const m = s.match(/^(?:\+?254|0)([71]\d{8})$/);
  return m ? `254${m[1]}` : null;
}

export const localPhone = (p: string) => (p.startsWith("254") ? `0${p.slice(3)}` : p);

// Nairobi is UTC+3 all year.
export function nairobiParts(d: Date = new Date()) {
  const n = new Date(d.getTime() + 3 * 3600 * 1000);
  return {
    year: n.getUTCFullYear(),
    month: n.getUTCMonth() + 1,
    day: n.getUTCDate(),
    hour: n.getUTCHours(),
    minute: n.getUTCMinutes(),
  };
}

export function monthKey(d: Date = new Date()) {
  const p = nairobiParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function monthRange(key: string) {
  const [y, m] = key.split("-").map(Number);
  // Nairobi midnight = UTC-3h
  const start = new Date(Date.UTC(y, m - 1, 1, -3, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, -3, 0, 0));
  return { start, end };
}

export function prevMonthKey(d: Date = new Date()) {
  const p = nairobiParts(d);
  const y = p.month === 1 ? p.year - 1 : p.year;
  const m = p.month === 1 ? 12 : p.month - 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function withinHours(open: string, close: string, d: Date = new Date()) {
  const p = nairobiParts(d);
  const cur = p.hour * 60 + p.minute;
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  return o <= c ? cur >= o && cur < c : cur >= o || cur < c;
}

export function fmtDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function waLink(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  received: "Received",
  paid: "Paid",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const firstNameInitial = (name: string | null | undefined) => {
  if (!name) return "Customer";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
};

export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Date(date.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 16);
}
export const fromLocalInput = (s: string) => new Date(`${s}:00+03:00`);
