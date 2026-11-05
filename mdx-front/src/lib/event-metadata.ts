import type { Metadata } from "next";
import type { PublicEvent } from "./api";

type MetadataEvent = Pick<PublicEvent, "slug" | "title" | "description" | "theme" | "preview">;
type StructuredEvent = MetadataEvent &
  Pick<PublicEvent, "status" | "startsAt" | "endsAt" | "place" | "address">;

const PUBLIC_ORIGIN = "https://mdx26.mermasdigitais.com.br";
const MDX_SOCIAL_IMAGE = "/social/mdx-2026-og.jpg";
const TIME_ZONE = "America/Fortaleza";

function publicOrigin(): string {
  return new URL(process.env.AUTH_URL ?? PUBLIC_ORIGIN).origin;
}

function eventUrl(event: MetadataEvent): string {
  return `${publicOrigin()}/e/${encodeURIComponent(event.slug)}`;
}

function socialImage(event: MetadataEvent): string | null {
  return event.slug === "mdx-2026" ? `${publicOrigin()}${MDX_SOCIAL_IMAGE}` : null;
}

/** Corta no limite sem dividir palavra. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function localDay(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function eventMetadata(event: MetadataEvent, banner: string | null): Metadata {
  const url = eventUrl(event);
  const isMdx = event.slug === "mdx-2026";
  const title = isMdx ? "MDX STEAM 2026 em Imperatriz" : event.title;
  const text = (event.description.trim() || event.theme.trim() || `Página do evento ${event.title}.`).replace(/\s+/g, " ");
  const description = truncate(text, 160);
  const image = socialImage(event);
  const images = image
    ? [{ url: image, width: 1200, height: 630, type: "image/jpeg", alt: "MDX STEAM 2026 — inscrições abertas até 20 de novembro." }]
    : banner ? [{ url: banner, alt: `Banner do evento ${event.title}` }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: event.preview
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { "max-image-preview": "large" } },
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

/** Event Schema.org só quando o evento é público, publicado, com datas e local válidos. */
export function eventStructuredData(event: StructuredEvent, banner: string | null): Record<string, unknown> | null {
  if (event.preview || event.status === "DRAFT") return null;
  if (!event.place.trim() || !event.address.trim()) return null;
  if (!event.startsAt || !event.endsAt) return null;

  const startDate = localDay(event.startsAt);
  const endDate = localDay(event.endsAt);
  if (!startDate || !endDate || endDate < startDate) return null;

  const image = socialImage(event) ?? banner;
  const text = (event.description.trim() || event.theme.trim() || "").replace(/\s+/g, " ");
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    url: eventUrl(event),
    startDate,
    endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(text ? { description: truncate(text, 500) } : {}),
    ...(image ? { image } : {}),
    location: {
      "@type": "Place",
      name: event.place,
      address: event.address,
    },
    organizer: {
      "@type": "Organization",
      name: "Mermãs Digitais",
    },
  };
}
