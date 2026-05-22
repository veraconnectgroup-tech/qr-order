import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QR Order",
    short_name: "QR Order",
    description: "Scan, order, pay — no app needed",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#f97316",
    icons: [],
  };
}
