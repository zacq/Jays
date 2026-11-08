import type { Metadata } from "next";
import EnquiryForm from "@/components/EnquiryForm";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "About Jay's & contact – Kiamunyi, Nakuru" };

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <h1 className="h1 !text-3xl sm:!text-4xl">About Jay&apos;s</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3 p-5 text-sm text-mute">
          <p>Jay&apos;s is a new liquor store in Kiamunyi, Nakuru County, and the first in the area to let you order online, pay with M-Pesa and get your drinks delivered to your door.</p>
          <p>We stock flavoured vodka, gin and whisky in 100ml, 200ml and 750ml bottles, with honey, ginger, pineapple and strawberry flavours.</p>
          <p><b className="text-white">Licence:</b> {s.shop.licence}</p>
          <p><b className="text-white">Address:</b> {s.shop.address}</p>
          <p><b className="text-white">Hours:</b> {s.shopHoursText}</p>
          <p><b className="text-white">Delivery hours:</b> {s.deliveryOpen}–{s.deliveryClose}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a className="btn-gold" href={`tel:${s.shop.phone.replace(/\s/g, "")}`}>📞 {s.shop.phone}</a>
            <a className="btn-green" href={`https://wa.me/${s.shop.whatsapp}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            <a className="btn-ghost" href={s.shop.tiktok} target="_blank" rel="noreferrer">🎵 TikTok</a>
          </div>
          <p className="text-xs">Drink responsibly. Not for sale to persons under 18.</p>
        </div>
        <iframe title="Jay's Liquor Store map" loading="lazy" className="h-72 w-full rounded-2xl border border-line md:h-full" src={`https://www.google.com/maps?q=${encodeURIComponent(s.shop.mapQuery)}&output=embed`} />
      </div>
      <EnquiryForm />
    </div>
  );
}
