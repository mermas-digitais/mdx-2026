"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { EmailGate, type VerifiedEmail } from "@/components/public/email-gate";
import { CpfField, PhoneField, formatCpf, inscriptionInputClass } from "@/components/public/masked-fields";
import { SteppedRegistration } from "@/components/public/stepped-registration";
import { TeamRegistration } from "@/components/public/team-registration";
import { Input } from "@/components/ui/input";
import { desistirEquipe, editarEquipe, tirarIntegrante, type RoboticsTeam } from "@/server/events";
import type { FormFieldConfig } from "@/server/form-schema";

const VERIFIED_STORAGE = "mdx-email-verificado";
const VERIFIED_FOR_MS = 2 * 60 * 60 * 1000;

const verificationListeners = new Set<() => void>();

function subscribeVerification(listener: () => void) {
  verificationListeners.add(listener);
  return () => verificationListeners.delete(listener);
}

function notifyVerification() {
  for (const listener of verificationListeners) listener();
}

function snapshotVerification(): string | null {
  try {
    const raw = window.localStorage.getItem(VERIFIED_STORAGE);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { email?: string; expiresAt?: number };
    if (!stored.email || typeof stored.expiresAt !== "number" || stored.expiresAt <= Date.now()) {
      window.localStorage.removeItem(VERIFIED_STORAGE);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function storeVerification(verified: VerifiedEmail) {
  window.localStorage.setItem(
    VERIFIED_STORAGE,
    JSON.stringify({ ...verified, expiresAt: Date.now() + VERIFIED_FOR_MS }),
  );
  notifyVerification();
}

function parseVerification(raw: string | null): VerifiedEmail | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as VerifiedEmail;
    if (!stored.email) return null;
    return { email: stored.email, name: stored.name ?? "", proof: stored.proof };
  } catch {
    return null;
  }
}

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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const storedVerification = useSyncExternalStore(subscribeVerification, snapshotVerification, () => null);
  const verified = parseVerification(storedVerification);

  function setVerified(next: VerifiedEmail) {
    storeVerification(next);
  }
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
    setPendingKey(`withdraw:${teamId}`);
    const result = await desistirEquipe(slug, teamId);
    setPendingKey(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setMine((current) => current.map((team) => (team.id === result.data.id ? result.data : team)));
    setNotice("Desistência registrada. A vaga confirmada passou para a lista de espera, se havia alguém.");
  }

  async function removeMember(teamId: string, memberId: string) {
    setPendingKey(`remove:${memberId}`);
    const result = await tirarIntegrante(slug, teamId, memberId);
    setPendingKey(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setMine((current) => current.map((team) => (team.id === result.data.id ? result.data : team)));
    setNotice("Integrante retirada da equipe.");
  }

  async function saveTeam(
    teamId: string,
    input: {
      teamName: string;
      advisorName: string;
      advisorPhone: string;
      advisorCpf: string;
      institution: string;
      members: { id: string; fullName: string; cpf: string; birthDate: string }[];
    },
  ): Promise<Record<string, string> | null> {
    setPendingKey(`save:${teamId}`);
    const result = await editarEquipe(slug, teamId, input);
    setPendingKey(null);
    if (!result.ok) {
      setNotice(result.message);
      return result.fields ?? {};
    }
    setMine((current) => current.map((team) => (team.id === result.data.id ? result.data : team)));
    setNotice("Dados atualizados.");
    return null;
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

  if ((path === "participant" || path === "team") && !verified) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={leaveForm} className="text-left text-sm text-[#A398AE]">
          Voltar
        </button>
        <EmailGate onVerified={setVerified} />
      </div>
    );
  }

  if (path === "participant" && verified) {
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

  if (path === "team" && verified) {
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
      {mine.length > 0 ? (
        <TeamList
          teams={mine}
          pendingKey={pendingKey}
          notice={notice}
          onWithdraw={(id) => void withdraw(id)}
          onRemove={(teamId, memberId) => void removeMember(teamId, memberId)}
          onSave={saveTeam}
          closed={closed || preview}
        />
      ) : null}
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
  pendingKey,
  notice,
  onWithdraw,
  onRemove,
  onSave,
  closed,
}: {
  teams: RoboticsTeam[];
  pendingKey: string | null;
  notice: string | null;
  onWithdraw: (teamId: string) => void;
  onRemove: (teamId: string, memberId: string) => void;
  onSave: (
    teamId: string,
    input: {
      teamName: string;
      advisorName: string;
      advisorPhone: string;
      advisorCpf: string;
      institution: string;
      members: { id: string; fullName: string; cpf: string; birthDate: string }[];
    },
  ) => Promise<Record<string, string> | null>;
  closed: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-heading text-2xl">Minhas equipes</h3>
      {notice ? <p role="status" className="text-sm font-semibold">{notice}</p> : null}
      {teams.map((team) => {
        const editable = !team.withdrawnAt && !closed;
        const editing = editingId === team.id;
        return (
          <article key={team.id} className="rounded-3xl border-4 border-[#330043] p-4">
            {editing ? (
              <TeamEditor
                team={team}
                pending={pendingKey === `save:${team.id}`}
                onCancel={() => setEditingId(null)}
                onSave={async (input) => {
                  const errors = await onSave(team.id, input);
                  if (!errors) setEditingId(null);
                  return errors;
                }}
              />
            ) : (
              <>
                <p className="font-heading text-xl">{team.name}</p>
                <p className="text-sm text-[#4C1D95]">{team.institution}</p>
                <p className="mt-1 text-sm">
                  {team.advisorName} · {team.advisorEmail}
                  {team.advisorPhone ? ` · ${team.advisorPhone}` : ""}
                </p>
                <ul className="mt-2 text-sm">
                  {team.modalities.map((modality) => (
                    <li key={modality.modalityId}>
                      {modality.name}: {slotLabel(modality.status)}
                    </li>
                  ))}
                </ul>
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {team.members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {member.fullName}
                        {member.linked ? ` · vinculada${member.accountEmail ? ` a ${member.accountEmail}` : ""}` : " · sem conta ainda"}
                        {member.accountInstitution ? ` · instituição na conta: ${member.accountInstitution}` : ""}
                      </span>
                      {editable && team.members.length > 3 ? (
                        <button
                          type="button"
                          className="font-bold text-[#BE185D] underline"
                          disabled={pendingKey === `remove:${member.id}`}
                          onClick={() => onRemove(team.id, member.id)}
                        >
                          {pendingKey === `remove:${member.id}` ? "Tirando…" : "Tirar da equipe"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {editable && team.members.length <= 3 ? (
                  <p className="mt-2 text-sm text-[#4C1D95]">A equipe precisa ficar com pelo menos 3 integrantes.</p>
                ) : null}
                {editable ? (
                  <div className="mt-3 flex flex-wrap gap-4">
                    <button
                      type="button"
                      className="font-bold text-[#2563EB] underline"
                      onClick={() => setEditingId(team.id)}
                    >
                      Editar dados
                    </button>
                    <button
                      type="button"
                      className="font-bold text-[#BE185D] underline"
                      disabled={pendingKey === `withdraw:${team.id}`}
                      onClick={() => onWithdraw(team.id)}
                    >
                      {pendingKey === `withdraw:${team.id}` ? "Registrando desistência…" : "Desistir da equipe"}
                    </button>
                  </div>
                ) : null}
                {team.withdrawnAt ? <p className="mt-2 text-sm font-semibold">Desistência registrada.</p> : null}
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}

function TeamEditor({
  team,
  pending,
  onCancel,
  onSave,
}: {
  team: RoboticsTeam;
  pending: boolean;
  onCancel: () => void;
  onSave: (input: {
    teamName: string;
    advisorName: string;
    advisorPhone: string;
    advisorCpf: string;
    institution: string;
    members: { id: string; fullName: string; cpf: string; birthDate: string }[];
  }) => Promise<Record<string, string> | null>;
}) {
  const [teamName, setTeamName] = useState(team.name);
  const [advisorName, setAdvisorName] = useState(team.advisorName);
  const [advisorPhone, setAdvisorPhone] = useState(team.advisorPhone);
  const [advisorCpf, setAdvisorCpf] = useState(formatCpf(team.advisorCpf));
  const [institution, setInstitution] = useState(team.institution);
  const [members, setMembers] = useState(
    team.members.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      cpf: formatCpf(member.cpf),
      birthDate: member.birthDate,
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateMember(id: string, patch: Partial<(typeof members)[number]>) {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ teamName, advisorName, advisorPhone, advisorCpf, institution, members }).then((next) => {
          if (next) setErrors(next);
        });
      }}
    >
      <EditField label="Nome da equipe" htmlFor={`team-${team.id}`} error={errors.teamName}>
        <Input id={`team-${team.id}`} className={inscriptionInputClass} value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
      </EditField>
      <p className="font-heading text-lg">Orientador</p>
      <EditField label="Nome" htmlFor={`advisor-name-${team.id}`} error={errors.advisorName}>
        <Input id={`advisor-name-${team.id}`} className={inscriptionInputClass} value={advisorName} onChange={(event) => setAdvisorName(event.target.value)} required />
      </EditField>
      <p className="text-sm text-[#4C1D95]">E-mail: {team.advisorEmail}</p>
      <EditField label="WhatsApp" htmlFor={`advisor-phone-${team.id}`} error={errors.advisorPhone}>
        <PhoneField id={`advisor-phone-${team.id}`} value={advisorPhone} onChange={setAdvisorPhone} invalid={Boolean(errors.advisorPhone)} />
      </EditField>
      <EditField label="CPF" htmlFor={`advisor-cpf-${team.id}`} error={errors.advisorCpf}>
        <CpfField id={`advisor-cpf-${team.id}`} value={advisorCpf} onChange={setAdvisorCpf} invalid={Boolean(errors.advisorCpf)} required />
      </EditField>
      <EditField label="Instituição de ensino" htmlFor={`institution-${team.id}`} error={errors.institution}>
        <Input id={`institution-${team.id}`} className={inscriptionInputClass} value={institution} onChange={(event) => setInstitution(event.target.value)} required />
      </EditField>
      <p className="font-heading text-lg">Integrantes</p>
      {errors.members ? <p className="text-sm font-semibold text-[#BE185D]">{errors.members}</p> : null}
      {members.map((member, index) => (
        <div key={member.id} className="flex flex-col gap-2 rounded-2xl bg-[#FFF6FB] p-3">
          <EditField label="Nome" htmlFor={`member-name-${member.id}`} error={errors[`members.${index}.fullName`]}>
            <Input
              id={`member-name-${member.id}`}
              className={inscriptionInputClass}
              value={member.fullName}
              onChange={(event) => updateMember(member.id, { fullName: event.target.value })}
              required
            />
          </EditField>
          <EditField label="CPF" htmlFor={`member-cpf-${member.id}`} error={errors[`members.${index}.cpf`]}>
            <CpfField
              id={`member-cpf-${member.id}`}
              value={member.cpf}
              onChange={(value) => updateMember(member.id, { cpf: value })}
              invalid={Boolean(errors[`members.${index}.cpf`])}
              required
            />
          </EditField>
          <EditField label="Data de nascimento" htmlFor={`member-birth-${member.id}`} error={errors[`members.${index}.birthDate`]}>
            <Input
              id={`member-birth-${member.id}`}
              className={inscriptionInputClass}
              type="date"
              value={member.birthDate}
              onChange={(event) => updateMember(member.id, { birthDate: event.target.value })}
              required
            />
          </EditField>
        </div>
      ))}
      <div className="flex flex-wrap gap-4">
        <button type="submit" className="font-bold text-[#2563EB] underline" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className="font-bold text-[#4C1D95] underline" disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function EditField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-[#330043]">{label}</label>
      {children}
      {error ? <p className="text-sm font-semibold text-[#BE185D]">{error}</p> : null}
    </div>
  );
}

function slotLabel(status: RoboticsTeam["modalities"][number]["status"]): string {
  if (status === "CONFIRMED") return "vaga confirmada";
  if (status === "WAITLIST") return "lista de espera";
  return "cancelada";
}
