import type { Metadata } from "next";
import { listarInscricoes, type InscriptionBoard, type RoboticsTeam } from "@/server/events";

export const metadata: Metadata = {
  title: "Inscrições",
};

export const instant = false;

const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

export default async function AdminPage() {
  const board = await listarInscricoes("mdx-2026");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div>
        <p className="text-sm font-semibold text-brand-purple">MDX 2026</p>
        <h1 className="font-heading text-3xl">Inscrições</h1>
      </div>
      {!board.ok ? <p>{board.message}</p> : <Board data={board.data} />}
    </main>
  );
}

function Board({ data }: { data: InscriptionBoard }) {
  const activeTeams = data.teams.filter((team) => !team.withdrawnAt);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-brand-purple">Participantes</p>
          <p className="font-heading text-4xl">{data.participants.length}</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-brand-purple">Equipes ativas</p>
          <p className="font-heading text-4xl">{activeTeams.length}</p>
        </article>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl">Participantes</h2>
        {data.participants.length === 0 ? <p>Nenhuma inscrição de participante ainda.</p> : null}
        <ul className="flex flex-col gap-3">
          {data.participants.map((person) => (
            <li key={person.id} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-xl">{person.name || "Sem nome"}</h3>
                <p className="text-sm text-brand-purple">{when.format(new Date(person.createdAt))}</p>
              </div>
              <p className="mt-1 text-sm">{person.email}</p>
              <p className="text-sm">Telefone {person.phone || "—"} · CPF {formatCpf(person.cpf)}</p>
              <p className="text-sm">Como soube: {person.heard || "—"}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl">Equipes</h2>
        {data.teams.length === 0 ? <p>Nenhuma equipe inscrita ainda.</p> : null}
        <ul className="flex flex-col gap-3">
          {data.teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </ul>
      </section>
    </>
  );
}

function TeamCard({ team }: { team: RoboticsTeam }) {
  return (
    <li className="rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-xl">{team.name}</h3>
        <p className="text-sm text-brand-purple">{team.institution}</p>
      </div>
      <p className="mt-1 text-sm">
        {team.advisorName} · {team.advisorEmail} · {team.advisorPhone}
      </p>
      {team.withdrawnAt ? <p className="mt-1 text-sm font-semibold">Desistência registrada.</p> : null}
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {team.modalities.map((modality) => (
          <li key={modality.modalityId}>
            {modality.name}: {modality.status === "CONFIRMED" ? "confirmada" : modality.status === "WAITLIST" ? "lista de espera" : "cancelada"}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        Integrantes: {team.members.map((member) => member.fullName).filter(Boolean).join(", ") || "—"}
      </p>
    </li>
  );
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value || "—";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
