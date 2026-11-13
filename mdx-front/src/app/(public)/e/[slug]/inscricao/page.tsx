import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { InscriptionFlow } from "@/components/public/inscription-flow";
import { auth } from "@/auth";
import type { FormFieldConfig } from "@/server/form-schema";
import { meuPerfil, minhasEquipes } from "@/server/events";
import { loadEventPage } from "@/server/public-event";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEventPage(slug);
  if (!event) return { title: "Inscrição", robots: { index: false, follow: false } };
  return {
    title: `Inscrição · ${event.title}`,
    description: `Inscrição no evento ${event.title}.`,
    robots: event.preview ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default function RegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ acesso?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl px-4 py-10 font-heading">
          <p>Carregando a inscrição…</p>
        </main>
      }
    >
      <RegistrationBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RegistrationBody({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ acesso?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [event, session] = await Promise.all([loadEventPage(slug), auth()]);
  if (event === null) notFound();
  if (!event) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 font-heading">
        <p>Não foi possível carregar o evento.</p>
      </main>
    );
  }

  const open = event.status === "PUBLISHED" && event.registrationsOpen && !event.preview;
  const loggedIn = Boolean(session?.user?.id);
  const [profile, teams] = loggedIn
    ? await Promise.all([meuPerfil(), minhasEquipes(event.slug)])
    : [null, null];

  return (
    <main
      className="flex min-h-[calc(100dvh-4.5rem)] flex-col bg-[#FF4A97] bg-cover bg-center font-heading text-[#330043]"
      style={{ backgroundImage: "url(/marca/banner-lp-oficial.svg)" }}
    >
      <div className="mx-auto my-auto grid w-full max-w-6xl items-center gap-5 px-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] md:gap-8 md:py-10">
        <img src="/marca/titulo.svg" alt="Mermãs Digitais" className="mx-auto w-full max-w-[17rem] md:hidden" />
        <div className="hidden justify-center md:flex">
          <img src="/marca/menina-mdx.svg" alt="" className="max-h-[72vh] w-full object-contain" />
        </div>
        <div id="inscricao-card" className="h-[calc(100dvh-15.5rem)] min-h-80 overflow-y-auto overscroll-contain rounded-[2rem] bg-white p-5 shadow-[0_24px_60px_rgba(51,0,67,0.18)] md:h-[36rem] sm:p-8">
          {event.preview ? (
            <p role="status" className="mb-4 rounded-2xl bg-[#FFCD34] px-4 py-3 font-bold">
              Este evento ainda é um rascunho. O envio não vale como inscrição.
            </p>
          ) : null}
          {!open && !event.preview ? (
            <p role="status" className="mb-4 font-bold">
              As inscrições deste evento estão encerradas.
            </p>
          ) : null}
          <InscriptionFlow
            slug={event.slug}
            fields={(event.fields ?? []) as FormFieldConfig[]}
            modalities={event.modalities ?? []}
            preview={event.preview}
            closed={!open && !event.preview}
            defaultName={session?.user?.name ?? ""}
            defaultEmail={session?.user?.email ?? ""}
            accountCpf={profile?.ok ? profile.data.cpf ?? "" : ""}
            teams={teams?.ok ? teams.data : []}
            startAtTeam={query.acesso === "equipe"}
          />
        </div>
      </div>
    </main>
  );
}
