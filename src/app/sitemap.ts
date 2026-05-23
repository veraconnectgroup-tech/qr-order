import type { MetadataRoute } from "next";

const BASE_URL = "https://qr-order-iota.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/enterprise", "/impressum", "/datenschutz", "/agb"];

  return routes.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
