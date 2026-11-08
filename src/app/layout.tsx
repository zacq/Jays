import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Jay's Liquor Store – Liquor delivery in Kiamunyi, Nakuru", template: "%s | Jay's Liquor Store" },
  description: "Order flavoured vodka, gin and whisky online in Nakuru. Pay with M-Pesa, delivered from Kiamunyi from KSh 500. 18+ only.",
  keywords: ["liquor delivery Nakuru", "drinks delivery Kiamunyi", "order alcohol online Nakuru"],
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0a0a0f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  const tt = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  const fb = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {ga && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}</Script>
          </>
        )}
        {tt && (
          <Script id="ttq" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";var s=d.createElement("script");s.async=!0;s.src=n+"?sdkid="+e+"&lib="+t;var x=d.getElementsByTagName("script")[0];x.parentNode.insertBefore(s,x)};ttq.load('${tt}');ttq.page()}(window,document,'ttq');`}</Script>
        )}
        {fb && (
          <Script id="fbq" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fb}');fbq('track','PageView');`}</Script>
        )}
      </body>
    </html>
  );
}
