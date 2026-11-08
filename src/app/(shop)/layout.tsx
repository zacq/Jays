import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import AgeGate from "@/components/AgeGate";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartBar from "@/components/CartBar";
import SourceCapture from "@/components/SourceCapture";
import { CartProvider } from "@/components/cart";
import { getSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";

export default async function ShopLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  const [s, jar] = await Promise.all([getSettings(), cookies()]);
  const verified = jar.get("jays_age")?.value === "1";
  const ld = {
    "@context": "https://schema.org",
    "@type": "LiquorStore",
    name: s.shop.name,
    address: { "@type": "PostalAddress", streetAddress: "Kiamunyi", addressLocality: "Nakuru", addressCountry: "KE" },
    telephone: s.shop.phone,
    openingHours: "Mo-Su 10:00-22:00",
    areaServed: "Nakuru County",
  };
  return (
    <CartProvider minDelivery={s.minDelivery} whatsapp={s.shop.whatsapp} phone={s.shop.phone}>
      <AgeGate verified={verified} />
      <Suspense>
        <SourceCapture />
      </Suspense>
      <Header />
      <main className="mx-auto min-h-[70vh] max-w-6xl px-3 pt-4 sm:px-4">{children}</main>
      <Footer s={s} />
      <CartBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </CartProvider>
  );
}
