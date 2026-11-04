"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmailGate, type VerifiedEmail } from "@/components/public/email-gate";
import { SteppedRegistration } from "@/components/public/stepped-registration";
import { TeamRegistration } from "@/components/public/team-registration";
import { desistirEquipe, type RoboticsTeam } from "@/server/events";
import type { FormFieldConfig } from "@/server/form-schema";

type Modality = {
  id: string;
  name: string;
  slotLimit: number;
  confirmed: number;
  waitlist: number;
};

export function InscriptionFlow({
  slug,
  fields,
  modalities,
  preview,
  closed,
  defaultName,
  defaultEmail,
  accountCpf,
  teams,
}: {
  slug: string;
  fields: FormFieldConfig[];
  modalities: Modality[];
  preview: boolean;
  closed: boolean;
  defaultName: string;
  defaultEmail: string;
  accountCpf: string;
  teams: RoboticsTeam[];
}) {
  const [path, setPath] = useState<"choose" | "participant" | "team">(
    modalities.length === 0 ? "participant" : "choose",
  );
  const [mine, setMine] = useState(teams);
  const [fresh, setFresh] = useState<RoboticsTeam | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const [verified, setVerified] = useState<VerifiedEmail | null>(null);
  const sameAccount = verified?.email === defaultEmail;

  function leaveForm() {
    if (modalities.length > 0) setPath("choose");
    else router.push(`/e/${slug}`);
  }

  async function checkCpf(cpf: string): Promise<string | null> {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const response = await fetch(`${api}/api/auth/cpf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf, email: verified?.email }),
    });
    const body = (await response.json().catch(() => null)) as { available?: boolean; message?: unknown } | null;
    if (!response.ok) {
      return typeof body?.message === "string" ? body.message : "Não foi possível conferir o CPF.";
    }
    if (body?.available === false) {
      return typeof body.message === "string" ? body.message : "Já existe uma conta com esse CPF.";
    }
    return null;
  }

  async function prepareAccount(name: string, cpf: string): Promise<string | null> {
    if (!verified?.proof) return null;
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const response = await fetch(`${api}/api/auth/register-proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof: verified.proof, name, cpf }),
    });
    const body = (await response.json().catch(() => null)) as { message?: unknown; token?: string } | null;
    if (!response.ok || !body?.token) {
      return typeof body?.message === "string" ? body.message : "Não foi possível criar a conta.";
    }
    const signed = await signIn("credentials", { apiToken: body.token, redirect: false });
    if (signed?.error) return "Não foi possível entrar com essa conta.";
    setVerified({ email: verified.email, name });
    return null;
  }

  async function withdraw(teamId: string) {
    setWithdrawing(teamId);
    const result = await desistirEquipe(slug, teamId);
    setWithdrawing(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setMine((current) => current.map((team) => (team.id === result.data.id ? result.data : team)));
    setNotice("Desistência registrada. A vaga confirmada passou para a lista de espera, se havia alguém.");
  }

  if (!verified) {
    return (
      <div className="flex flex-col gap-4">
        <QuietBack href={`/e/${slug}`} />
        <EmailGate initialEmail={defaultEmail} onVerified={setVerified} />
      </div>
    );
  }

  if (fresh) {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="rounded-3xl border-4 border-[#330043] bg-[#FFCD34] p-6 shadow-[6px_6px_0_#330043]">
          <p className="font-heading text-3xl">Equipe inscrita</p>
          <p className="mt-2 font-semibold">{fresh.name} · {fresh.institution}</p>
          <ul className="mt-3 flex flex-col gap-1">
            {fresh.modalities.map((modality) => (
              <li key={modality.modalityId}>
                {modality.name}: {modality.status === "CONFIRMED" ? "vaga confirmada" : modality.status === "WAITLIST" ? "lista de espera" : "cancelada"}
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {fresh.members.map((member) => (
              <li key={member.id}>
                {member.fullName} · {member.linked ? `conta vinculada${member.accountName ? ` (${member.accountName})` : ""}` : "ainda sem conta"}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-[#4C1D95]">
          A ficha da equipe não gera passaporte. Cada integrante se inscreve como participante, com o mesmo CPF, para ter o código do evento.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="font-bold text-[#BE185D] underline" onClick={() => { setFresh(null); setPath("team"); }}>
            Inscrever outra equipe
          </button>
          <button type="button" className="font-bold text-[#4C1D95] underline" onClick={() => { setFresh(null); setPath("participant"); }}>
            Me inscrever como participante
          </button>
        </div>
      </div>
    );
  }

  if (path === "participant") {
    return (
      <div className="flex flex-col gap-4">
        <SteppedRegistration
          fields={fields}
          slug={slug}
          preview={preview}
          closed={closed}
          defaultName={verified.name || (sameAccount ? defaultName : "")}
          defaultEmail={verified.email}
          accountCpf={sameAccount ? accountCpf : ""}
          prepareAccount={prepareAccount}
          checkCpf={checkCpf}
          onBack={leaveForm}
        />
      </div>
    );
  }

  if (path === "team") {
    return (
      <div className="flex flex-col gap-4">
        <TeamRegistration
          slug={slug}
          modalities={modalities}
          closed={closed || preview}
          advisorName={verified.name || (sameAccount ? defaultName : "")}
          advisorEmail={verified.email}
          advisorCpf={sameAccount ? accountCpf : ""}
          prepareAccount={prepareAccount}
          checkCpf={checkCpf}
          onBack={leaveForm}
          onRegistered={(team) => {
            setMine((current) => [team, ...current.filter((item) => item.id !== team.id)]);
            setFresh(team);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <QuietBack href={`/e/${slug}`} />
      <h2 className="text-center font-heading text-3xl">Como quer se inscrever?</h2>
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setPath("participant")}
          className="rounded-3xl bg-[#FFF6FB] p-5 text-left ring-1 ring-[#F6E9FF] transition-transform hover:-translate-y-0.5"
        >
          <span className="font-heading text-2xl">Participar do evento</span>
          <span className="mt-1 block text-sm text-[#4C1D95]">Oficinas, stands e o restante da programação. Não inscreve no desafio de robótica.</span>
        </button>
        <button
          type="button"
          onClick={() => setPath("team")}
          className="rounded-3xl bg-gradient-to-r from-[#FF4A97] to-[#FFB347] p-5 text-left text-white shadow-[0_10px_24px_rgba(255,74,151,0.28)] transition-transform hover:-translate-y-0.5"
        >
          <span className="font-heading text-2xl">Inscrever equipe</span>
          <span className="mt-1 block text-sm">Só o orientador. Caça Balão, Sumô e Corrida com obstáculos.</span>
        </button>
      </div>
      {mine.length > 0 ? <TeamList teams={mine} pendingId={withdrawing} notice={notice} onWithdraw={(id) => void withdraw(id)} closed={closed || preview} /> : null}
    </div>
  );
}

function QuietBack({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm text-[#A398AE]">
      Voltar
    </Link>
  );
}

function TeamList({
  teams,
  pendingId,
  notice,
  onWithdraw,
  closed,
}: {
  teams: RoboticsTeam[];
  pendingId: string | null;
  notice: string | null;
  onWithdraw: (teamId: string) => void;
  closed: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-heading text-2xl">Minhas equipes</h3>
      {notice ? <p role="status" className="text-sm font-semibold">{notice}</p> : null}
      {teams.map((team) => (
        <article key={team.id} className="rounded-3xl border-4 border-[#330043] p-4">
          <p className="font-heading text-xl">{team.name}</p>
          <p className="text-sm text-[#4C1D95]">{team.institution}</p>
          <ul className="mt-2 text-sm">
            {team.modalities.map((modality) => (
              <li key={modality.modalityId}>
                {modality.name}: {slotLabel(modality.status)}
              </li>
            ))}
          </ul>
          <ul className="mt-2 text-sm">
            {team.members.map((member) => (
              <li key={member.id}>
                {member.fullName}
                {member.linked ? ` · vinculada${member.accountEmail ? ` a ${member.accountEmail}` : ""}` : " · sem conta ainda"}
                {member.accountInstitution ? ` · instituição na conta: ${member.accountInstitution}` : ""}
              </li>
            ))}
          </ul>
          {!team.withdrawnAt && !closed ? (
            <button
              type="button"
              className="mt-3 font-bold text-[#BE185D] underline"
              disabled={pendingId === team.id}
              onClick={() => onWithdraw(team.id)}
            >
              {pendingId === team.id ? "Registrando desistência…" : "Desistir da equipe"}
            </button>
          ) : null}
          {team.withdrawnAt ? <p className="mt-2 text-sm font-semibold">Desistência registrada.</p> : null}
        </article>
      ))}
    </section>
  );
}

function slotLabel(status: RoboticsTeam["modalities"][number]["status"]): string {
  if (status === "CONFIRMED") return "vaga confirmada";
  if (status === "WAITLIST") return "lista de espera";
  return "cancelada";
}
