"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { formatCpf } from "@/components/public/masked-fields";
import {
  editarEquipeNoPainel,
  editarInscricao,
  excluirEquipeNoPainel,
  excluirInscricao,
  tirarIntegranteNoPainel,
  type InscriptionBoard,
  type ParticipantInscription,
  type RoboticsTeam,
} from "@/server/events";

const HEARD = ["Instagram", "Amigos", "Escola", "Outros"];

const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

const fieldClass =
  "h-10 w-full rounded-xl border border-[#E7DFF0] bg-white px-3 text-sm text-[#330043] outline-none focus:border-[#9B6DFF]";

export function InscriptionDesk({ initial }: { initial: InscriptionBoard }) {
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState<"people" | "teams">("teams");
  const [query, setQuery] = useState("");
  const [heard, setHeard] = useState("todas");
  const [personFrom, setPersonFrom] = useState("");
  const [personTo, setPersonTo] = useState("");
  const [modality, setModality] = useState("todas");
  const [slot, setSlot] = useState("todas");
  const [teamState, setTeamState] = useState("ativas");
  const [size, setSize] = useState("todas");
  const [account, setAccount] = useState("todas");
  const [teamFrom, setTeamFrom] = useState("");
  const [teamTo, setTeamTo] = useState("");
  const [teamView, setTeamView] = useState<"equipes" | "alunas">("equipes");
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => setBoard(initial), [initial]);

  const people = useMemo(
    () => board.participants.filter((person) => matchesPerson(person, query, heard, personFrom, personTo)),
    [board.participants, query, heard, personFrom, personTo],
  );
  const teams = useMemo(
    () => board.teams.filter((team) => matchesTeam(team, {
      query, modality, slot, teamState, size, account, teamFrom, teamTo,
    })),
    [board.teams, query, modality, slot, teamState, size, account, teamFrom, teamTo],
  );
  const modalityNames = useMemo(() => {
    const names = new Set<string>();
    for (const team of board.teams) {
      for (const item of team.modalities) names.add(item.name);
    }
    return [...names];
  }, [board.teams]);
  const heardOptions = useMemo(() => {
    const values = new Set(HEARD);
    for (const person of board.participants) if (person.heard) values.add(person.heard);
    return [...values];
  }, [board.participants]);
  const girls = useMemo(
    () => teams.flatMap((team) => activeMembers(team).map((member) => ({ member, team }))),
    [teams],
  );
  const openTeam = board.teams.find((team) => team.id === openTeamId) ?? null;

  function apply(next: InscriptionBoard, message: string) {
    setBoard(next);
    setNotice(message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 text-[#330043]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#7A6B86]">{board.event.title}</p>
          <h1 className="font-heading text-3xl">Inscrições</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={quietButton} onClick={() => exportPeople(people)}>
            Exportar participantes
          </button>
          <button type="button" className={quietButton} onClick={() => exportTeams(teams)}>
            Exportar equipes
          </button>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Participantes" value={board.participants.length} />
        <Stat label="Equipes ativas" value={board.teams.filter((team) => !team.withdrawnAt).length} />
        <Stat label="Alunas nas equipes" value={girls.length} />
        {modalityNames.map((name) => (
          <Stat
            key={name}
            label={name}
            value={board.teams.filter((team) => !team.withdrawnAt && team.modalities.some((item) => item.name === name && item.status === "CONFIRMED")).length}
          />
        ))}
      </dl>

      {notice ? <p role="status" className="text-sm font-semibold">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        <TabButton current={tab} value="teams" onClick={setTab}>Equipes de robótica</TabButton>
        <TabButton current={tab} value="people" onClick={setTab}>Participantes</TabButton>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-[#7A6B86]">Busca</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === "people" ? "Nome, e-mail, telefone ou CPF" : "Equipe, escola, orientador, aluna ou CPF"}
          className={fieldClass}
        />
      </label>

      {tab === "people" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Como soube" value={heard} onChange={setHeard}>
              <option value="todas">Todas</option>
              {heardOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
            <DateField label="De" value={personFrom} onChange={setPersonFrom} />
            <DateField label="Até" value={personTo} onChange={setPersonTo} />
          </div>
          <p className="text-sm text-[#7A6B86]">{people.length} na lista</p>
          {people.length === 0 ? <Empty>Nenhuma participante com esses filtros.</Empty> : null}
          <ul className="flex flex-col gap-3">
            {people.map((person) => (
              <ParticipantCard
                key={person.id}
                person={person}
                pending={pending}
                onSave={async (input) => {
                  setPending(person.id);
                  const result = await editarInscricao(board.event.slug, person.id, input);
                  setPending(null);
                  if (!result.ok) return result.fields ?? { form: result.message };
                  apply(result.data, "Inscrição atualizada.");
                  return null;
                }}
                onDelete={async () => {
                  if (!window.confirm(`Excluir a inscrição de ${person.name || person.email}? O passaporte deixa de valer. A conta continua.`)) return;
                  setPending(`delete:${person.id}`);
                  const result = await excluirInscricao(board.event.slug, person.id);
                  setPending(null);
                  if (!result.ok) {
                    setNotice(result.message);
                    return;
                  }
                  apply(result.data, "Inscrição excluída.");
                }}
              />
            ))}
          </ul>
        </>
      ) : openTeam ? (
        <TeamSheet
          team={openTeam}
          slug={board.event.slug}
          pending={pending}
          onBack={() => setOpenTeamId(null)}
          onSave={async (input) => {
            setPending(`save:${openTeam.id}`);
            const result = await editarEquipeNoPainel(board.event.slug, openTeam.id, input);
            setPending(null);
            if (!result.ok) return result.fields ?? { form: result.message };
            apply(result.data, "Equipe atualizada.");
            return null;
          }}
          onRemove={async (memberId) => {
            setPending(`remove:${memberId}`);
            const result = await tirarIntegranteNoPainel(board.event.slug, openTeam.id, memberId);
            setPending(null);
            if (!result.ok) {
              setNotice(result.message);
              return;
            }
            apply(result.data, "Integrante retirada da equipe.");
          }}
          onDelete={async () => {
            if (!window.confirm(`Excluir a equipe ${openTeam.name}? Uma vaga confirmada passa para a lista de espera.`)) return;
            setPending(`delete:${openTeam.id}`);
            const result = await excluirEquipeNoPainel(board.event.slug, openTeam.id);
            setPending(null);
            if (!result.ok) {
              setNotice(result.message);
              return;
            }
            setOpenTeamId(null);
            apply(result.data, "Equipe excluída.");
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterPill current={modality} value="todas" onClick={setModality}>Todas as modalidades</FilterPill>
            {modalityNames.map((name) => (
              <FilterPill key={name} current={modality} value={name} onClick={setModality}>{name}</FilterPill>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Select label="Vaga" value={slot} onChange={setSlot}>
              <option value="todas">Todas</option>
              <option value="CONFIRMED">Confirmada</option>
              <option value="WAITLIST">Lista de espera</option>
              <option value="CANCELLED">Cancelada</option>
            </Select>
            <Select label="Equipe" value={teamState} onChange={setTeamState}>
              <option value="ativas">Ativas</option>
              <option value="desistencias">Desistências</option>
              <option value="todas">Ativas e desistências</option>
            </Select>
            <Select label="Integrantes ativas" value={size} onChange={setSize}>
              <option value="todas">Todas</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="menos">Menos de 3</option>
            </Select>
            <Select label="Conta das alunas" value={account} onChange={setAccount}>
              <option value="todas">Todas</option>
              <option value="sem-conta">Alguma sem conta</option>
              <option value="com-conta">Todas com conta</option>
              <option value="retirada">Alguma retirada</option>
            </Select>
            <DateField label="Inscrita de" value={teamFrom} onChange={setTeamFrom} />
            <DateField label="Inscrita até" value={teamTo} onChange={setTeamTo} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#7A6B86]">
              {girls.length} {girls.length === 1 ? "aluna" : "alunas"} em {teams.length} {teams.length === 1 ? "equipe" : "equipes"}
            </p>
            <div className="flex gap-1 rounded-full bg-white p-1">
              <FilterPill current={teamView} value="equipes" onClick={(value) => setTeamView(value === "alunas" ? "alunas" : "equipes")}>Equipes</FilterPill>
              <FilterPill current={teamView} value="alunas" onClick={(value) => setTeamView(value === "alunas" ? "alunas" : "equipes")}>Todas as alunas</FilterPill>
            </div>
          </div>
          {teams.length === 0 ? <Empty>Nenhuma equipe com esses filtros.</Empty> : null}
          {teamView === "alunas" ? (
            <ul className="overflow-hidden rounded-2xl bg-white">
              {girls.map(({ member, team }) => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3E9FA] px-4 py-3 last:border-0">
                  <div>
                    <p className="font-semibold">{member.fullName}</p>
                    <p className="text-sm text-[#7A6B86]">
                      {formatCpf(member.cpf)} · {member.birthDate.split("-").reverse().join("/")} · {team.name}
                    </p>
                  </div>
                  <button type="button" className="text-sm font-semibold text-[#6D28D9]" onClick={() => setOpenTeamId(team.id)}>
                    {team.institution}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
          <ul className="flex flex-col gap-2">
            {teams.map((team) => (
              <li key={team.id} className="rounded-2xl bg-white px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-xl">{team.name}</h2>
                    <p className="text-sm text-[#7A6B86]">{team.institution} · {activeMembers(team).length} alunas</p>
                    <p className="mt-1 text-sm">{team.advisorName} · {team.advisorEmail}</p>
                  </div>
                  <button type="button" className="text-sm font-semibold text-[#6D28D9]" onClick={() => setOpenTeamId(team.id)}>
                    Ver ficha
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#7A6B86]">
                  {team.modalities.map((item) => `${item.name} (${slotLabel(item.status)})`).join(" · ")}
                  {team.withdrawnAt ? " · Desistiu" : ""}
                </p>
                <p className="mt-1 text-sm">
                  {activeMembers(team).map((member) => member.fullName).join(", ") || "Sem integrantes ativas"}
                </p>
              </li>
            ))}
          </ul>
          )}
        </>
      )}
    </div>
  );
}

function ParticipantCard({
  person,
  pending,
  onSave,
  onDelete,
}: {
  person: ParticipantInscription;
  pending: string | null;
  onSave: (input: { name: string; email: string; phone: string; cpf: string; heard: string }) => Promise<Record<string, string> | null>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);
  const [phone, setPhone] = useState(person.phone);
  const [cpf, setCpf] = useState(formatCpf(person.cpf));
  const [heard, setHeard] = useState(person.heard);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(person.name);
    setEmail(person.email);
    setPhone(person.phone);
    setCpf(formatCpf(person.cpf));
    setHeard(person.heard);
  }, [person]);

  if (!editing) {
    return (
      <li className="rounded-2xl bg-white px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl">{person.name || "Sem nome"}</h2>
          <p className="text-sm font-semibold text-[#4C1D95]">{when.format(new Date(person.createdAt))}</p>
        </div>
        <p className="mt-1 text-sm">{person.email}</p>
        <p className="text-sm">Telefone {person.phone || "—"} · CPF {formatCpf(person.cpf) || "—"}</p>
        <p className="text-sm">Como soube: {person.heard || "—"} · Passaporte {person.passportCode}</p>
        <div className="mt-3 flex gap-4">
          <button type="button" className="font-bold text-[#2563EB] underline" onClick={() => setEditing(true)}>Editar</button>
          <button type="button" className="font-bold text-[#BE185D] underline" disabled={pending === `delete:${person.id}`} onClick={() => void onDelete()}>
            {pending === `delete:${person.id}` ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-2xl bg-white px-4 py-3">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ name, email, phone, cpf, heard }).then((next) => {
            if (next) setErrors(next);
            else setEditing(false);
          });
        }}
      >
        <Field label="Nome" error={errors.name}>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="E-mail da conta" error={errors.email}>
          <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Telefone" error={errors.phone}>
          <input className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="CPF" error={errors.cpf}>
          <input className={fieldClass} value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} />
        </Field>
        <Field label="Como soube" error={errors.heard}>
          <select className={fieldClass} value={heard} onChange={(event) => setHeard(event.target.value)}>
            <option value="">—</option>
            {(HEARD.includes(heard) || heard === "" ? HEARD : [heard, ...HEARD]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </Field>
        {errors.form ? <p className="text-sm font-bold text-[#BE185D]">{errors.form}</p> : null}
        <div className="flex gap-4">
          <button type="submit" className="font-bold text-[#2563EB] underline" disabled={pending === person.id}>
            {pending === person.id ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" className="font-bold underline" onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      </form>
    </li>
  );
}

function TeamSheet({
  team,
  slug,
  pending,
  onBack,
  onSave,
  onRemove,
  onDelete,
}: {
  team: RoboticsTeam;
  slug: string;
  pending: string | null;
  onBack: () => void;
  onSave: (input: {
    teamName: string;
    advisorName: string;
    advisorEmail: string;
    advisorPhone: string;
    advisorCpf: string;
    institution: string;
    members: { id: string; fullName: string; cpf: string; birthDate: string }[];
  }) => Promise<Record<string, string> | null>;
  onRemove: (memberId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const active = activeMembers(team);
  const [teamName, setTeamName] = useState(team.name);
  const [advisorName, setAdvisorName] = useState(team.advisorName);
  const [advisorEmail, setAdvisorEmail] = useState(team.advisorEmail);
  const [advisorPhone, setAdvisorPhone] = useState(team.advisorPhone);
  const [advisorCpf, setAdvisorCpf] = useState(formatCpf(team.advisorCpf));
  const [institution, setInstitution] = useState(team.institution);
  const [members, setMembers] = useState(active.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    cpf: formatCpf(member.cpf),
    birthDate: member.birthDate,
  })));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const next = activeMembers(team);
    setTeamName(team.name);
    setAdvisorName(team.advisorName);
    setAdvisorEmail(team.advisorEmail);
    setAdvisorPhone(team.advisorPhone);
    setAdvisorCpf(formatCpf(team.advisorCpf));
    setInstitution(team.institution);
    setMembers(next.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      cpf: formatCpf(member.cpf),
      birthDate: member.birthDate,
    })));
  }, [team]);

  return (
    <article className="rounded-2xl bg-white p-5">
      <button type="button" className="text-sm font-bold text-[#4C1D95] underline" onClick={onBack}>Voltar para a lista</button>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ teamName, advisorName, advisorEmail, advisorPhone, advisorCpf, institution, members }).then((next) => {
            if (next) setErrors(next);
          });
        }}
      >
        <h2 className="text-3xl">Ficha da equipe</h2>
        <Field label="Nome da equipe" error={errors.teamName}>
          <input className={fieldClass} value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
        </Field>
        <Field label="Instituição de ensino" error={errors.institution}>
          <input className={fieldClass} value={institution} onChange={(event) => setInstitution(event.target.value)} required />
        </Field>
        <div className="flex flex-wrap gap-2">
          {team.modalities.map((item) => (
            <span key={item.modalityId} className="rounded-full bg-[#F6F0FF] px-3 py-1 text-sm text-[#4C1D95]">
              {item.name}: {slotLabel(item.status)}
            </span>
          ))}
        </div>
        <p className="text-sm">Inscrita em {when.format(new Date(team.createdAt))}</p>
        {team.withdrawnAt ? <p className="font-bold">Desistência em {when.format(new Date(team.withdrawnAt))}.</p> : null}
        <h3 className="text-2xl">Orientador</h3>
        <Field label="Nome" error={errors.advisorName}>
          <input className={fieldClass} value={advisorName} onChange={(event) => setAdvisorName(event.target.value)} required />
        </Field>
        <Field label="E-mail da conta" error={errors.advisorEmail}>
          <input className={fieldClass} type="email" value={advisorEmail} onChange={(event) => setAdvisorEmail(event.target.value)} required />
        </Field>
        <Field label="WhatsApp" error={errors.advisorPhone}>
          <input className={fieldClass} value={advisorPhone} onChange={(event) => setAdvisorPhone(event.target.value)} required />
        </Field>
        <Field label="CPF" error={errors.advisorCpf}>
          <input className={fieldClass} value={advisorCpf} onChange={(event) => setAdvisorCpf(formatCpf(event.target.value))} required />
        </Field>
        <p className="text-sm">
          <a className="font-bold text-[#2563EB] underline" href={`/api/equipes/${slug}/${team.id}/advisor`} target="_blank" rel="noreferrer">Documento do orientador</a>
        </p>
        <h3 className="text-2xl">Integrantes</h3>
        {errors.members ? <p className="text-sm font-bold text-[#BE185D]">{errors.members}</p> : null}
        {members.map((member, index) => (
          <div key={member.id} className="flex flex-col gap-2 rounded-xl bg-[#FBF8FF] p-4">
            <Field label="Nome" error={errors[`members.${index}.fullName`]}>
              <input className={fieldClass} value={member.fullName} onChange={(event) => updateMember(setMembers, member.id, { fullName: event.target.value })} required />
            </Field>
            <Field label="CPF" error={errors[`members.${index}.cpf`]}>
              <input className={fieldClass} value={member.cpf} onChange={(event) => updateMember(setMembers, member.id, { cpf: formatCpf(event.target.value) })} required />
            </Field>
            <Field label="Data de nascimento" error={errors[`members.${index}.birthDate`]}>
              <input className={fieldClass} type="date" value={member.birthDate} onChange={(event) => updateMember(setMembers, member.id, { birthDate: event.target.value })} required />
            </Field>
            <MemberAccount team={team} memberId={member.id} />
            <div className="flex flex-wrap gap-4">
              <a className="text-sm font-bold text-[#2563EB] underline" href={`/api/equipes/${slug}/${team.id}/${member.id}`} target="_blank" rel="noreferrer">Documento da integrante</a>
              <button type="button" className="text-sm font-bold text-[#BE185D] underline" disabled={pending === `remove:${member.id}`} onClick={() => void onRemove(member.id)}>
                {pending === `remove:${member.id}` ? "Tirando…" : "Tirar da equipe"}
              </button>
            </div>
          </div>
        ))}
        {team.members.filter((member) => member.releasedAt).map((member) => (
          <div key={member.id} className="rounded-xl bg-[#F6F0FF] p-4 text-sm text-[#7A6B86]">
            <p className="font-bold">{member.fullName} · retirada da equipe</p>
            <p>CPF {formatCpf(member.cpf)} · nascimento {member.birthDate.split("-").reverse().join("/")}</p>
            <p>Retirada em {when.format(new Date(member.releasedAt ?? ""))}</p>
          </div>
        ))}
        {errors.form ? <p className="text-sm font-bold text-[#BE185D]">{errors.form}</p> : null}
        <div className="flex flex-wrap gap-4">
          <button type="submit" className={quietButton} disabled={pending === `save:${team.id}`}>
            {pending === `save:${team.id}` ? "Salvando…" : "Salvar ficha"}
          </button>
          <button type="button" className="font-bold text-[#BE185D] underline" disabled={pending === `delete:${team.id}`} onClick={() => void onDelete()}>
            {pending === `delete:${team.id}` ? "Excluindo…" : "Excluir equipe"}
          </button>
        </div>
      </form>
    </article>
  );
}

function MemberAccount({ team, memberId }: { team: RoboticsTeam; memberId: string }) {
  const member = team.members.find((item) => item.id === memberId);
  if (!member) return null;
  return (
    <p className="text-sm">
      {member.linked
        ? `Conta: ${member.accountName ?? "vinculada"}${member.accountEmail ? ` · ${member.accountEmail}` : ""}${member.accountPhone ? ` · ${member.accountPhone}` : ""}`
        : "Ainda sem conta com este CPF."}
      {member.accountInstitution ? ` · instituição na conta: ${member.accountInstitution}` : ""}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <dt className="text-xs text-[#7A6B86]">{label}</dt>
      <dd className="font-heading text-2xl">{value}</dd>
    </div>
  );
}

function TabButton({
  current,
  value,
  onClick,
  children,
}: {
  current: string;
  value: "people" | "teams";
  onClick: (value: "people" | "teams") => void;
  children: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-[#330043] text-white" : "bg-white text-[#330043]"}`}
    >
      {children}
    </button>
  );
}

function FilterPill({
  current,
  value,
  onClick,
  children,
}: {
  current: string;
  value: string;
  onClick: (value: string) => void;
  children: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${active ? "bg-[#F3E8FF] text-[#6D28D9]" : "text-[#7A6B86]"}`}
    >
      {children}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-[#7A6B86]">
      {label}
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-[#7A6B86]">
      {label}
      <input className={fieldClass} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-[#7A6B86]">
      {label}
      {children}
      {error ? <span className="font-semibold text-[#BE185D]">{error}</span> : null}
    </label>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#7A6B86]">{children}</p>;
}

const quietButton = "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#330043] disabled:opacity-60";

function activeMembers(team: RoboticsTeam) {
  return team.members.filter((member) => !member.releasedAt);
}

function updateMember(
  setMembers: Dispatch<SetStateAction<{ id: string; fullName: string; cpf: string; birthDate: string }[]>>,
  id: string,
  patch: Partial<{ fullName: string; cpf: string; birthDate: string }>,
) {
  setMembers((current) => current.map((member) => (member.id === id ? { ...member, ...patch } : member)));
}

function matchesPerson(person: ParticipantInscription, query: string, heard: string, from: string, to: string) {
  const day = fortalezaDay(person.createdAt);
  if (from && day < from) return false;
  if (to && day > to) return false;
  if (heard !== "todas" && person.heard !== heard) return false;
  return includes(query, [person.name, person.email, person.phone, person.cpf, person.passportCode]);
}

function matchesTeam(team: RoboticsTeam, filter: {
  query: string;
  modality: string;
  slot: string;
  teamState: string;
  size: string;
  account: string;
  teamFrom: string;
  teamTo: string;
}) {
  const day = fortalezaDay(team.createdAt);
  if (filter.teamFrom && day < filter.teamFrom) return false;
  if (filter.teamTo && day > filter.teamTo) return false;
  if (filter.teamState === "ativas" && team.withdrawnAt) return false;
  if (filter.teamState === "desistencias" && !team.withdrawnAt) return false;
  if (filter.modality !== "todas" && !team.modalities.some((item) => item.name === filter.modality)) return false;
  const slots = filter.modality === "todas"
    ? team.modalities
    : team.modalities.filter((item) => item.name === filter.modality);
  if (filter.slot !== "todas" && !slots.some((item) => item.status === filter.slot)) return false;
  const active = activeMembers(team);
  if (filter.size === "menos" && active.length >= 3) return false;
  if (filter.size !== "todas" && filter.size !== "menos" && String(active.length) !== filter.size) return false;
  if (filter.account === "sem-conta" && !active.some((member) => !member.linked)) return false;
  if (filter.account === "com-conta" && (active.length === 0 || active.some((member) => !member.linked))) return false;
  if (filter.account === "retirada" && !team.members.some((member) => member.releasedAt)) return false;
  return includes(filter.query, [
    team.name,
    team.institution,
    team.advisorName,
    team.advisorEmail,
    team.advisorPhone,
    team.advisorCpf,
    ...team.members.flatMap((member) => [member.fullName, member.cpf, member.accountEmail ?? "", member.accountName ?? ""]),
  ]);
}

function includes(query: string, values: string[]) {
  const needle = query.trim().toLowerCase().replace(/\D/g, "").length >= 3 && /^[\d.\-\s()]+$/.test(query.trim())
    ? query.replace(/\D/g, "")
    : query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value.toLowerCase().includes(needle) || value.replace(/\D/g, "").includes(needle));
}

function fortalezaDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date(iso));
}

function slotLabel(status: RoboticsTeam["modalities"][number]["status"]) {
  if (status === "CONFIRMED") return "confirmada";
  if (status === "WAITLIST") return "lista de espera";
  return "cancelada";
}

function exportPeople(people: ParticipantInscription[]) {
  download("participantes-mdx-2026.csv", [
    ["Nome", "E-mail", "Telefone", "CPF", "Como soube", "Passaporte", "Situação", "Inscrita em"],
    ...people.map((person) => [
      person.name,
      person.email,
      person.phone,
      formatCpf(person.cpf),
      person.heard,
      person.passportCode,
      person.status,
      when.format(new Date(person.createdAt)),
    ]),
  ]);
}

function exportTeams(teams: RoboticsTeam[]) {
  const rows = [["Equipe", "Instituição", "Inscrita em", "Desistiu em", "Modalidades", "Orientador", "E-mail", "WhatsApp", "CPF do orientador", "Integrante", "CPF", "Nascimento", "Conta", "E-mail da conta", "Telefone da conta", "Instituição da conta", "Retirada em"]];
  for (const team of teams) {
    const modalities = team.modalities.map((item) => `${item.name} (${slotLabel(item.status)})`).join(" | ");
    const base = [
      team.name,
      team.institution,
      when.format(new Date(team.createdAt)),
      team.withdrawnAt ? when.format(new Date(team.withdrawnAt)) : "",
      modalities,
      team.advisorName,
      team.advisorEmail,
      team.advisorPhone,
      formatCpf(team.advisorCpf),
    ];
    if (team.members.length === 0) {
      rows.push([...base, "", "", "", "", "", "", "", ""]);
      continue;
    }
    for (const member of team.members) {
      rows.push([
        ...base,
        member.fullName,
        formatCpf(member.cpf),
        member.birthDate.split("-").reverse().join("/"),
        member.linked ? (member.accountName ?? "vinculada") : "sem conta",
        member.accountEmail ?? "",
        member.accountPhone ?? "",
        member.accountInstitution ?? "",
        member.releasedAt ? when.format(new Date(member.releasedAt)) : "",
      ]);
    }
  }
  download("equipes-mdx-2026.csv", rows);
}

function download(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
