import type { ReactNode } from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/admin/actions";
import { ensureSeed } from "@/lib/seed";

export const metadata = { title: "Jay's Admin", robots: { index: false, follow: false } };

const LINKS: { href: string; label: string; roles: string[] }[] = [
  { href: "/admin", label: "Dashboard", roles: ["owner", "attendant"] },
  { href: "/admin/orders", label: "Orders", roles: ["owner", "attendant", "rider"] },
  { href: "/admin/stock", label: "Stock", roles: ["owner", "attendant"] },
  { href: "/admin/products", label: "Products", roles: ["owner"] },
  { href: "/admin/customers", label: "Customers", roles: ["owner", "attendant"] },
  { href: "/admin/campaigns", label: "Campaigns", roles: ["owner"] },
  { href: "/admin/promos", label: "Promo codes", roles: ["owner"] },
  { href: "/admin/loyalty", label: "Loyalty", roles: ["owner"] },
  { href: "/admin/inbox", label: "Messages", roles: ["owner", "attendant"] },
  { href: "/admin/settings", label: "Settings", roles: ["owner"] },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  const session = await getSession();
  return (
    <div className="admin min-h-screen bg-slate-100">
      {session && (
        <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2">
            <Link href="/admin" className="text-lg font-black">
              Jay&apos;s <span className="text-amber-500">Admin</span>
            </Link>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize">{session.role}</span>
            <span className="ml-auto text-xs text-slate-500">{session.name}</span>
            <Link href="/" className="text-xs font-semibold text-slate-600 underline">Shop</Link>
            <form action={logoutAction}>
              <button className="text-xs font-semibold text-red-600 underline">Log out</button>
            </form>
          </div>
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2">
            {LINKS.filter((l) => l.roles.includes(session.role)).map((l) => (
              <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-amber-100">
                {l.label}
              </Link>
            ))}
          </nav>
        </header>
      )}
      <div className="mx-auto max-w-7xl p-3">{children}</div>
    </div>
  );
}
