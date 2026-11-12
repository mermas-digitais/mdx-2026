import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listarEquipes, obterEvento } from "@/server/events";

export const metadata: Metadata = {
  title: "Equipes",
};

export default async function EquipesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [event, teams] = await Promise.all([obterEvento(eventId), listarEquipes(eventId)]);
  if (!event.ok || !teams.ok) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-purple">{event.data.title}</p>
          <h1 className="font-heading text-3xl">Equipes de robótica</h1>
        </div>
        <Link href={`/admin/eventos/${eventId}?etapa=equipes`} className="font-semibold text-brand-pink-dark underline">
          Voltar ao evento
        </Link>
      </div>
      {teams.data.length === 0 ? <p>Nenhuma equipe inscrita ainda.</p> : null}
      <ul className="flex flex-col gap-4">
        {teams.data.map((team) => (
          <li key={team.id} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-2xl">{team.name}</h2>
              <p className="text-sm text-brand-purple">{team.institution}</p>
            </div>
            <p className="mt-1 text-sm">
              {team.advisorName} · {team.advisorEmail} · {team.advisorPhone}
            </p>
            {team.withdrawnAt ? <p className="mt-1 text-sm font-semibold">Desistência registrada.</p> : null}
            <p className="mt-3 text-sm font-semibold">
              <a className="underline" href={`/api/equipes/${event.data.slug}/${team.id}/advisor`}>
                Documento do orientador
              </a>
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {team.modalities.map((modality) => (
                <li key={modality.modalityId} className="text-sm">
                  {modality.name}: {modality.status === "CONFIRMED" ? "confirmada" : modality.status === "WAITLIST" ? "lista de espera" : "cancelada"}
                </li>
              ))}
            </ul>
            <ul className="mt-3 flex flex-col gap-3">
              {team.members.map((member) => (
                <li key={member.id} className="rounded-xl bg-brand-lilac/40 px-3 py-2 text-sm">
                  <p className="font-semibold">{member.fullName}</p>
                  <p>CPF {member.cpf} · nascimento {member.birthDate.split("-").reverse().join("/")}</p>
                  {member.releasedAt ? <p>Retirada da equipe.</p> : null}
                  <p>
                    {member.linked
                      ? `Conta: ${member.accountName ?? "vinculada"}${member.accountEmail ? ` · ${member.accountEmail}` : ""}${member.accountPhone ? ` · ${member.accountPhone}` : ""}`
                      : "Ainda sem conta com este CPF."}
                  </p>
                  {member.accountInstitution ? <p>Instituição na inscrição pessoal: {member.accountInstitution}</p> : null}
                  <a className="underline" href={`/api/equipes/${event.data.slug}/${team.id}/${member.id}`}>
                    Documento da integrante
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
