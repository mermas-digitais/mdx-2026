import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { bannerSrc } from "@/components/admin/event-format";
import { EventHome } from "@/components/public/event-home";
import { loadEventPage } from "@/server/public-event";
import { eventMetadata, eventStructuredData } from "@/lib/event-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEventPage(slug);
  if (!event) {
    return { title: "Evento", robots: { index: false, follow: false } };
  }
  return eventMetadata(event, bannerSrc(event.banner));
}

export default function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
          <p>Carregando o evento…</p>
        </main>
      }
    >
      <PublicEventBody params={params} />
    </Suspense>
  );
}

async function PublicEventBody({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await loadEventPage(slug);
  if (event === null) notFound();
  if (!event) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <p>Não foi possível carregar o evento.</p>
      </main>
    );
  }

  const structured = eventStructuredData(event, bannerSrc(event.banner));

  return (
    <>
      {structured ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <EventHome event={event} />
    </>
  );
}
