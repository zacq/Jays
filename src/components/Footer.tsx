import Link from "next/link";
import type { AppSettings } from "@/lib/settings";

export default function Footer({ s }: { s: AppSettings }) {
  return (
    <footer className="mt-16 border-t border-line bg-panel/60 px-4 pb-32 pt-10">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
        <div>
          <p className="text-lg font-black">
            JAY&apos;S<span className="text-gold">.</span>
          </p>
          <p className="mt-2 text-sm text-mute">{s.shop.address}</p>
          <p className="mt-1 text-sm text-mute">{s.shopHoursText}</p>
          <p className="mt-1 text-sm text-mute">{s.shop.licence}</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-bold">Get in touch</p>
          <a className="block text-mute hover:text-gold" href={`tel:${s.shop.phone.replace(/\s/g, "")}`}>
            📞 {s.shop.phone}
          </a>
          <a className="block text-mute hover:text-gold" href={`https://wa.me/${s.shop.whatsapp}`}>
            💬 WhatsApp
          </a>
          <a className="block text-mute hover:text-gold" href={s.shop.tiktok} target="_blank" rel="noreferrer">
            🎵 TikTok
          </a>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-bold">Legal</p>
          {[
            ["terms", "Terms of sale"],
            ["privacy", "Privacy policy"],
            ["rewards-terms", "Rewards terms"],
            ["top-buyers-terms", "Top Buyers terms"],
          ].map(([slug, label]) => (
            <Link key={slug} href={`/legal/${slug}`} className="block text-mute hover:text-gold">
              {label}
            </Link>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl border-t border-line pt-4 text-center text-xs font-semibold text-mute">
        Drink responsibly. Not for sale to persons under 18. © {new Date().getFullYear()} Jay&apos;s Liquor Store, Kiamunyi.
      </p>
    </footer>
  );
}
