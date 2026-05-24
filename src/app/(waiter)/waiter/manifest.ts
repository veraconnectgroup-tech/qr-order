import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vera Waiter",
    short_name: "Vera W",
    description: "Waiter view for Vera POS",
    start_url: "/waiter",
    scope: "/waiter/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#f97316",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
