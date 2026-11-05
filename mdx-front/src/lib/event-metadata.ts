import type { Metadata } from "next";
import type { PublicEvent } from "./api";

export function eventMetadata(
  event: Pick<PublicEvent, "slug" | "title" | "description" | "theme" | "preview">,
  banner: string | null,
): Metadata {
  const origin = new URL(process.env.AUTH_URL ?? "https://mdx26.mermasdigitais.com.br").origin;
  const url = `${origin}/e/${encodeURIComponent(event.slug)}`;
  const isMdx = event.slug === "mdx-2026";
  const title = isMdx ? "MDX STEAM 2026" : event.title;
  const text = (event.description.trim() || event.theme.trim() || `Página do evento ${event.title}.`).replace(/\s+/g, " ");
  const description = text.length > 180 ? `${text.slice(0, 177)}…` : text;
  const images = isMdx
    ? [{
        url: `${origin}/social/mdx-2026-og.jpg`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "MDX STEAM 2026 — inscrições abertas até 20 de novembro.",
      }]
    : banner ? [{ url: banner, alt: `Banner do evento ${event.title}` }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: event.preview ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      locale: "pt_BR",
      siteName: "Mermãs Digitais",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
