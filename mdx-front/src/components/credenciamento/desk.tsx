"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatCpf, formatPhone } from "@/components/public/masked-fields";
import {
  confirmarPresencaAluna,
  confirmarPresencaOrientador,
  confirmarPresencaParticipante,
  sairCredenciamento,
} from "@/server/credenciamento";
import type { InscriptionBoard, ParticipantInscription, RoboticsMember, RoboticsTeam } from "@/server/events";

const HEARD = ["Instagram", "Amigos", "Escola", "Outros"];

const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

const fieldClass =
  "h-10 w-full rounded-xl border border-[#E7DFF0] bg-white px-3 text-sm text-[#330043] outline-none focus:border-[#9B6DFF]";

export function CredenciamentoDesk({ initial }: { initial: InscriptionBoard }) {
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState<"teams" | "advisors" | "people">("teams");
  const [query, setQuery] = useState("");
  const [heard, setHeard] = useState("todas");
  const [presence, setPresence] = useState("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modality, setModality] = useState("todas");
  const [slot, setSlot] = useState("todas");
  const [teamState, setTeamState] = useState("ativas");
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => setBoard(initial), [initial]);

  const modalityNames = useMemo(() => {
    const names = (board.modalities ?? []).map((item) => item.name);
    for (const team of board.teams) {
      for (const item of team.modalities) {
        if (!names.includes(item.name)) names.push(item.name);
      }
    }
    return names;
  }, [board.modalities, board.teams]);
  const heardOptions = useMemo(() => {
    const values = new Set(HEARD);
    for (const person of board.participants) if (person.heard) values.add(person.heard);
    return [...values];
  }, [board.participants]);

  const people = useMemo(
    () => board.participants.filter((person) => matchesPerson(person, query, heard, presence, from, to)),
    [board.participants, query, heard, presence, from, to],
  );
  const teams = useMemo(
    () => board.teams.filter((team) => matchesTeam(team, { query, modality, slot, teamState, presence, from, to })),
    [board.teams, query, modality, slot, teamState, presence, from, to],
  );
  const advisorTeams = useMemo(
    () => board.teams.filter((team) => matchesTeam(team, {
      query: "",
      modality,
      slot,
      teamState,
      presence: "todas",
      from,
      to,
    })),
    [board.teams, modality, slot, teamState, from, to],
  );
  const advisors = useMemo(
    () => listAdvisors(advisorTeams, query, presence),
    [advisorTeams, query, presence],
  );
  const openTeam = board.teams.find((team) => team.id === openTeamId) ?? null;

  const activeTeams = board.teams.filter((team) => !team.withdrawnAt);
  const activeGirls = activeTeams.flatMap((team) => activeMembers(team));
  const girlsPresent = activeGirls.filter((member) => member.checkedInAt).length;
  const advisorsPresent = activeTeams.filter((team) => team.advisorCheckedInAt).length;
  const peoplePresent = board.participants.filter((person) => person.checkedInAt).length;

  function apply(next: InscriptionBoard, message: string) {
    setBoard(next);
    setNotice(message);
    router.refresh();
  }

  async function togglePerson(person: ParticipantInscription) {
    const key = `person:${person.id}`;
    setPending(key);
    setNotice(null);
    const present = !person.checkedInAt;
    const result = await confirmarPresencaParticipante(board.event.slug, person.id, present);
    setPending(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    apply(result.data, present ? "Presença confirmada." : "Presença desfeita.");
  }

  async function toggleAdvisor(team: RoboticsTeam) {
    const key = `advisor:${team.id}`;
    setPending(key);
    setNotice(null);
    const present = !team.advisorCheckedInAt;
    const result = await confirmarPresencaOrientador(board.event.slug, team.id, present);
    setPending(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    apply(result.data, present ? "Presença confirmada." : "Presença desfeita.");
  }

  async function toggleMember(team: RoboticsTeam, member: RoboticsMember) {
    const key = `member:${member.id}`;
    setPending(key);
    setNotice(null);
    const present = !member.checkedInAt;
    const result = await confirmarPresencaAluna(board.event.slug, team.id, member.id, present);
    setPending(null);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    apply(result.data, present ? "Presença confirmada." : "Presença desfeita.");
  }

  function chooseTab(value: "teams" | "advisors" | "people") {
    setTab(value);
    setOpenTeamId(null);
  }

  async function leave() {
    setLeaving(true);
    await sairCredenciamento();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 text-[#330043]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#7A6B86]">{board.event.title}</p>
          <h1 className="font-heading text-3xl">Credenciamento</h1>
        </div>
        <button type="button" className={quietButton} disabled={leaving} onClick={() => void leave()}>
          {leaving ? "Saindo…" : "Sair"}
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Participantes presentes" value={`${peoplePresent}/${board.participants.length}`} />
        <Stat label="Alunas presentes" value={`${girlsPresent}/${activeGirls.length}`} />
        <Stat label="Orientadores presentes" value={`${advisorsPresent}/${activeTeams.length}`} />
        <Stat label="Presenças confirmadas" value={peoplePresent + girlsPresent + advisorsPresent} />
      </dl>

      {notice ? <p role="status" className="text-sm font-semibold">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        <TabButton current={tab} value="teams" onClick={chooseTab}>Equipes de robótica</TabButton>
        <TabButton current={tab} value="advisors" onClick={chooseTab}>Orientadores</TabButton>
        <TabButton current={tab} value="people" onClick={chooseTab}>Participantes</TabButton>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-[#7A6B86]">Busca</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === "people" ? "Nome, e-mail, telefone ou CPF" : tab === "advisors" ? "Nome, e-mail, telefone ou CPF" : "Equipe, escola, orientador, aluna, e-mail ou CPF"}
          className={fieldClass}
        />
      </label>

      {openTeam ? (
        <TeamSheet
          team={openTeam}
          pending={pending}
          onBack={() => setOpenTeamId(null)}
          onAdvisor={() => void toggleAdvisor(openTeam)}
          onMember={(member) => void toggleMember(openTeam, member)}
        />
      ) : tab === "advisors" ? (
        <Advisors
          advisors={advisors}
          pending={pending}
          modalityNames={modalityNames}
          modality={modality}
          slot={slot}
          teamState={teamState}
          presence={presence}
          from={from}
          to={to}
          onModality={setModality}
          onSlot={setSlot}
          onTeamState={setTeamState}
          onPresence={setPresence}
          onFrom={setFrom}
          onTo={setTo}
          onAdvisor={(team) => void toggleAdvisor(team)}
        />
      ) : tab === "people" ? (
        <People
          people={people}
          pending={pending}
          heard={heard}
          heardOptions={heardOptions}
          presence={presence}
          from={from}
          to={to}
          onHeard={setHeard}
          onPresence={setPresence}
          onFrom={setFrom}
          onTo={setTo}
          onToggle={(person) => void togglePerson(person)}
        />
      ) : (
        <Teams
          teams={teams}
          pending={pending}
          modalityNames={modalityNames}
          modality={modality}
          slot={slot}
          teamState={teamState}
          presence={presence}
          from={from}
          to={to}
          onModality={setModality}
          onSlot={setSlot}
          onTeamState={setTeamState}
          onPresence={setPresence}
          onFrom={setFrom}
          onTo={setTo}
          onOpen={setOpenTeamId}
          onAdvisor={(team) => void toggleAdvisor(team)}
          onMember={(team, member) => void toggleMember(team, member)}
        />
      )}
    </div>
  );
}

function People({
  people,
  pending,
  heard,
  heardOptions,
  presence,
  from,
  to,
  onHeard,
  onPresence,
  onFrom,
  onTo,
  onToggle,
}: {
  people: ParticipantInscription[];
  pending: string | null;
  heard: string;
  heardOptions: string[];
  presence: string;
  from: string;
  to: string;
  onHeard: (value: string) => void;
  onPresence: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onToggle: (person: ParticipantInscription) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Como soube" value={heard} onChange={onHeard}>
          <option value="todas">Todas</option>
          {heardOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
        <PresenceSelect value={presence} onChange={onPresence} />
        <DateField label="De" value={from} onChange={onFrom} />
        <DateField label="Até" value={to} onChange={onTo} />
      </div>
      <p className="text-sm text-[#7A6B86]">{people.length} na lista. A presença da inscrição geral não marca a aluna na equipe.</p>
      {people.length === 0 ? <Empty>Nenhuma participante com esses filtros.</Empty> : null}
      <ul className="flex flex-col gap-3">
        {people.map((person) => (
          <li key={person.id} className="rounded-2xl bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl">{person.name || "Sem nome"}</h2>
                <p className="mt-1 text-sm">{person.email}</p>
                <p className="text-sm">Telefone {formatPhone(person.phone) || "—"} · CPF {formatCpf(person.cpf) || "—"}</p>
                <p className="text-sm text-[#7A6B86]">Como soube: {person.heard || "—"} · Passaporte {person.passportCode}</p>
                <p className="text-sm text-[#7A6B86]">Inscrição {when.format(new Date(person.createdAt))}</p>
              </div>
              <PresenceButton
                at={person.checkedInAt}
                pending={pending === `person:${person.id}`}
                onClick={() => onToggle(person)}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Teams({
  teams,
  pending,
  modalityNames,
  modality,
  slot,
  teamState,
  presence,
  from,
  to,
  onModality,
  onSlot,
  onTeamState,
  onPresence,
  onFrom,
  onTo,
  onOpen,
  onAdvisor,
  onMember,
}: {
  teams: RoboticsTeam[];
  pending: string | null;
  modalityNames: string[];
  modality: string;
  slot: string;
  teamState: string;
  presence: string;
  from: string;
  to: string;
  onModality: (value: string) => void;
  onSlot: (value: string) => void;
  onTeamState: (value: string) => void;
  onPresence: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onOpen: (id: string) => void;
  onAdvisor: (team: RoboticsTeam) => void;
  onMember: (team: RoboticsTeam, member: RoboticsMember) => void;
}) {
  return (
    <>
      <TeamFilters
        modalityNames={modalityNames}
        modality={modality}
        slot={slot}
        teamState={teamState}
        presence={presence}
        from={from}
        to={to}
        onModality={onModality}
        onSlot={onSlot}
        onTeamState={onTeamState}
        onPresence={onPresence}
        onFrom={onFrom}
        onTo={onTo}
      />
      <p className="text-sm text-[#7A6B86]">{teams.length} na lista. Presente exige orientador e todas as alunas ativas.</p>
      {teams.length === 0 ? <Empty>Nenhuma equipe com esses filtros.</Empty> : null}
      <ul className="flex flex-col gap-3">
        {teams.map((team) => (
          <li key={team.id} className="rounded-2xl bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl">{team.name}</h2>
                <p className="text-sm text-[#7A6B86]">{team.institution}</p>
                <p className="mt-1 text-sm text-[#7A6B86]">
                  {team.modalities.map((item) => `${item.name} (${slotLabel(item.status)})`).join(" · ") || "Sem modalidade"}
                  {team.withdrawnAt ? " · Desistiu" : ""}
                </p>
              </div>
              <button type="button" className="text-sm font-semibold text-[#6D28D9]" onClick={() => onOpen(team.id)}>
                Ver ficha
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              <PersonRow
                role="Orientador"
                name={team.advisorName}
                detail={`${team.advisorEmail} · ${formatPhone(team.advisorPhone) || team.advisorPhone} · CPF ${formatCpf(team.advisorCpf) || "—"}`}
                at={team.advisorCheckedInAt}
                pending={pending === `advisor:${team.id}`}
                onClick={() => onAdvisor(team)}
              />
              {activeMembers(team).map((member) => (
                <PersonRow
                  key={member.id}
                  role="Aluna"
                  name={member.fullName}
                  detail={`CPF ${formatCpf(member.cpf)} · nasc. ${formatDay(member.birthDate)}`}
                  at={member.checkedInAt}
                  pending={pending === `member:${member.id}`}
                  onClick={() => onMember(team, member)}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

function Advisors({
  advisors,
  pending,
  modalityNames,
  modality,
  slot,
  teamState,
  presence,
  from,
  to,
  onModality,
  onSlot,
  onTeamState,
  onPresence,
  onFrom,
  onTo,
  onAdvisor,
}: {
  advisors: AdvisorRow[];
  pending: string | null;
  modalityNames: string[];
  modality: string;
  slot: string;
  teamState: string;
  presence: string;
  from: string;
  to: string;
  onModality: (value: string) => void;
  onSlot: (value: string) => void;
  onTeamState: (value: string) => void;
  onPresence: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onAdvisor: (team: RoboticsTeam) => void;
}) {
  return (
    <>
      <TeamFilters
        modalityNames={modalityNames}
        modality={modality}
        slot={slot}
        teamState={teamState}
        presence={presence}
        from={from}
        to={to}
        onModality={onModality}
        onSlot={onSlot}
        onTeamState={onTeamState}
        onPresence={onPresence}
        onFrom={onFrom}
        onTo={onTo}
      />
      <p className="text-sm text-[#7A6B86]">
        {advisors.length} {advisors.length === 1 ? "orientador" : "orientadores"}. A presença é de cada equipe.
      </p>
      {advisors.length === 0 ? <Empty>Nenhum orientador com esses filtros.</Empty> : null}
      <ul className="flex flex-col gap-3">
        {advisors.map((advisor) => (
          <li key={advisor.key} className="rounded-2xl bg-white px-4 py-3">
            <h2 className="font-heading text-xl">{advisor.name}</h2>
            <p className="mt-1 text-sm">{advisor.email} · {formatPhone(advisor.phone) || advisor.phone} · CPF {formatCpf(advisor.cpf) || "—"}</p>
            <p className="text-sm text-[#7A6B86]">{advisor.institutions.join(", ")}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {advisor.teams.map((team) => (
                <PersonRow
                  key={team.id}
                  role="Equipe"
                  name={team.name}
                  detail={team.institution}
                  at={team.advisorCheckedInAt}
                  pending={pending === `advisor:${team.id}`}
                  onClick={() => onAdvisor(team)}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

function TeamSheet({
  team,
  pending,
  onBack,
  onAdvisor,
  onMember,
}: {
  team: RoboticsTeam;
  pending: string | null;
  onBack: () => void;
  onAdvisor: () => void;
  onMember: (member: RoboticsMember) => void;
}) {
  return (
    <section className="rounded-2xl bg-white px-4 py-4">
      <button type="button" className="text-sm font-semibold text-[#6D28D9]" onClick={onBack}>
        Voltar para a lista
      </button>
      <h2 className="mt-3 font-heading text-3xl">{team.name}</h2>
      <p className="text-sm text-[#7A6B86]">{team.institution}</p>
      <p className="mt-2 text-sm">
        {team.modalities.map((item) => `${item.name} (${slotLabel(item.status)})`).join(" · ") || "Sem modalidade"}
        {team.withdrawnAt ? ` · Desistiu em ${when.format(new Date(team.withdrawnAt))}` : ""}
      </p>
      <p className="mt-1 text-sm text-[#7A6B86]">Inscrita em {when.format(new Date(team.createdAt))}</p>

      <div className="mt-5">
        <h3 className="font-heading text-xl">Orientador</h3>
        <ul className="mt-2">
          <PersonRow
            role="Orientador"
            name={team.advisorName}
            detail={`${team.advisorEmail} · ${formatPhone(team.advisorPhone) || team.advisorPhone} · CPF ${formatCpf(team.advisorCpf) || "—"}`}
            at={team.advisorCheckedInAt}
            pending={pending === `advisor:${team.id}`}
            onClick={onAdvisor}
          />
        </ul>
      </div>

      <div className="mt-5">
        <h3 className="font-heading text-xl">Alunas</h3>
        {activeMembers(team).length === 0 ? <p className="mt-2 text-sm text-[#7A6B86]">Nenhuma aluna ativa.</p> : null}
        <ul className="mt-2 flex flex-col gap-2">
        {activeMembers(team).map((member) => (
          <PersonRow
            key={member.id}
            role="Aluna"
            name={member.fullName}
            detail={[
              `CPF ${formatCpf(member.cpf)}`,
              `nasc. ${formatDay(member.birthDate)}`,
              member.accountEmail,
              member.accountPhone ? formatPhone(member.accountPhone) : null,
            ].filter(Boolean).join(" · ")}
            at={member.checkedInAt}
            pending={pending === `member:${member.id}`}
            onClick={() => onMember(member)}
          />
        ))}
        </ul>
        {team.members.filter((member) => member.releasedAt).map((member) => (
          <p key={member.id} className="text-sm text-[#7A6B86]">
            {member.fullName} saiu da equipe.
          </p>
        ))}
      </div>
    </section>
  );
}

function TeamFilters(props: {
  modalityNames: string[];
  modality: string;
  slot: string;
  teamState: string;
  presence: string;
  from: string;
  to: string;
  onModality: (value: string) => void;
  onSlot: (value: string) => void;
  onTeamState: (value: string) => void;
  onPresence: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Select label="Modalidade" value={props.modality} onChange={props.onModality}>
        <option value="todas">Todas</option>
        {props.modalityNames.map((name) => <option key={name} value={name}>{name}</option>)}
      </Select>
      <Select label="Vaga" value={props.slot} onChange={props.onSlot}>
        <option value="todas">Todas</option>
        <option value="CONFIRMED">Confirmada</option>
        <option value="WAITLIST">Lista de espera</option>
        <option value="CANCELLED">Cancelada</option>
      </Select>
      <Select label="Equipe" value={props.teamState} onChange={props.onTeamState}>
        <option value="ativas">Ativas</option>
        <option value="desistencias">Desistências</option>
        <option value="todas">Todas</option>
      </Select>
      <PresenceSelect value={props.presence} onChange={props.onPresence} />
      <DateField label="De" value={props.from} onChange={props.onFrom} />
      <DateField label="Até" value={props.to} onChange={props.onTo} />
    </div>
  );
}

function PersonRow({
  role,
  name,
  detail,
  at,
  pending,
  onClick,
}: {
  role: string;
  name: string;
  detail: string;
  at: string | null;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FBF8FF] px-3 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7A6B86]">{role}</p>
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-[#7A6B86]">{detail}</p>
      </div>
      <PresenceButton at={at} pending={pending} onClick={onClick} />
    </li>
  );
}

function PresenceButton({ at, pending, onClick }: { at: string | null; pending: boolean; onClick: () => void }) {
  if (at) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-sm font-semibold text-[#166534]">
          Presente · {when.format(new Date(at))}
        </span>
        <button type="button" className="text-sm font-semibold text-[#7A6B86] underline disabled:opacity-60" disabled={pending} onClick={onClick}>
          {pending ? "Salvando…" : "Desfazer"}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="h-10 rounded-full bg-[#330043] px-4 text-sm font-bold text-white disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Confirmar presença"}
    </button>
  );
}

function PresenceSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select label="Presença" value={value} onChange={onChange}>
      <option value="todas">Todas</option>
      <option value="presentes">Presentes</option>
      <option value="pendentes">Pendentes</option>
    </Select>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <dt className="text-sm text-[#7A6B86]">{label}</dt>
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
  value: string;
  onClick: (value: "teams" | "advisors" | "people") => void;
  children: string;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value as "teams" | "advisors" | "people")}
      className={selected ? "rounded-full bg-[#330043] px-4 py-2 text-sm font-semibold text-white" : quietButton}
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

function Empty({ children }: { children: string }) {
  return <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#7A6B86]">{children}</p>;
}

const quietButton = "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#330043] disabled:opacity-60";

function activeMembers(team: RoboticsTeam) {
  return team.members.filter((member) => !member.releasedAt);
}

function teamIsPresent(team: RoboticsTeam) {
  return Boolean(team.advisorCheckedInAt) && activeMembers(team).every((member) => member.checkedInAt);
}

function matchesPerson(
  person: ParticipantInscription,
  query: string,
  heard: string,
  presence: string,
  from: string,
  to: string,
) {
  const day = fortalezaDay(person.createdAt);
  if (from && day < from) return false;
  if (to && day > to) return false;
  if (heard !== "todas" && person.heard !== heard) return false;
  if (presence === "presentes" && !person.checkedInAt) return false;
  if (presence === "pendentes" && person.checkedInAt) return false;
  return includes(query, [person.name, person.email, person.phone, person.cpf, person.passportCode]);
}

function matchesTeam(team: RoboticsTeam, filter: {
  query: string;
  modality: string;
  slot: string;
  teamState: string;
  presence: string;
  from: string;
  to: string;
}) {
  const day = fortalezaDay(team.createdAt);
  if (filter.from && day < filter.from) return false;
  if (filter.to && day > filter.to) return false;
  if (filter.teamState === "ativas" && team.withdrawnAt) return false;
  if (filter.teamState === "desistencias" && !team.withdrawnAt) return false;
  if (filter.modality !== "todas" && !team.modalities.some((item) => item.name === filter.modality)) return false;
  const slots = filter.modality === "todas"
    ? team.modalities
    : team.modalities.filter((item) => item.name === filter.modality);
  if (filter.slot !== "todas" && !slots.some((item) => item.status === filter.slot)) return false;
  if (filter.presence === "presentes" && !teamIsPresent(team)) return false;
  if (filter.presence === "pendentes" && teamIsPresent(team)) return false;
  return includes(filter.query, [
    team.name,
    team.institution,
    team.advisorName,
    team.advisorEmail,
    team.advisorPhone,
    team.advisorCpf,
    ...team.members.flatMap((member) => [
      member.fullName,
      member.cpf,
      member.accountEmail ?? "",
      member.accountName ?? "",
      member.accountPhone ?? "",
    ]),
  ]);
}

function includes(query: string, values: string[]) {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, "");
  const needle = digits.length >= 3 && /^[\d.\-\s()]+$/.test(trimmed) ? digits : trimmed.toLowerCase();
  if (!needle) return true;
  return values.some((value) => value.toLowerCase().includes(needle) || value.replace(/\D/g, "").includes(needle));
}

function fortalezaDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date(iso));
}

function formatDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function slotLabel(status: RoboticsTeam["modalities"][number]["status"]) {
  if (status === "CONFIRMED") return "confirmada";
  if (status === "WAITLIST") return "lista de espera";
  return "cancelada";
}

type AdvisorRow = {
  key: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  institutions: string[];
  teams: RoboticsTeam[];
};

function listAdvisors(teams: RoboticsTeam[], query: string, presence: string): AdvisorRow[] {
  const groups = new Map<string, RoboticsTeam[]>();
  for (const team of teams) {
    const key = advisorKey(team);
    const group = groups.get(key) ?? [];
    group.push(team);
    groups.set(key, group);
  }
  const rows: AdvisorRow[] = [];
  for (const [key, group] of groups) {
    const latest = [...group].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (!latest) continue;
    const present = group.every((team) => team.advisorCheckedInAt);
    if (presence === "presentes" && !present) continue;
    if (presence === "pendentes" && present) continue;
    const row: AdvisorRow = {
      key,
      name: latest.advisorName,
      email: latest.advisorEmail,
      phone: latest.advisorPhone,
      cpf: latest.advisorCpf,
      institutions: [...new Set(group.map((team) => team.institution))].sort((left, right) => left.localeCompare(right, "pt-BR")),
      teams: [...group].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    };
    if (!includes(query, [row.name, row.email, row.phone, row.cpf, ...row.institutions, ...row.teams.map((team) => team.name)])) continue;
    rows.push(row);
  }
  return rows.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function advisorKey(team: RoboticsTeam) {
  const email = team.advisorEmail.trim().toLowerCase();
  if (email) return `email:${email}`;
  const cpf = team.advisorCpf.replace(/\D/g, "");
  if (cpf) return `cpf:${cpf}`;
  return `name:${team.advisorName.trim().toLowerCase()}`;
}
