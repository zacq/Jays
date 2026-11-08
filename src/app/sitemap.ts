import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const prods = await getProducts();
  const pages = ["", "/shop", "/offers", "/rewards", "/delivery", "/track", "/contact"].map((p) => ({ url: `${base}${p}` }));
  return [...pages, ...prods.map((p) => ({ url: `${base}/product/${p.slug}` }))];
}
