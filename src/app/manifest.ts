import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jay's Liquor Store",
    short_name: "Jay's",
    description: "Order drinks online in Nakuru. Pay with M-Pesa. Delivered from Kiamunyi.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#f7b500",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
