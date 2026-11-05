import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/conta", "/entrar"] },
    sitemap: "https://mdx26.mermasdigitais.com.br/sitemap.xml",
  };
}
