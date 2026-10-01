import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://emboogway.com";
  const routes = [
    "",
    "/about",
    "/devlog",
    "/lore",
    "/studio",
    "/games/waytable",
    "/games/the-dm",
    "/games/geostory",
  ];
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
