"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  canReopen,
  finishBlock,
  groupClosed,
  isGroupMatch,
  qualifyCount,
  resolveBracket,
  resultNote,
  sidesOf,
  standings,
  tablePlace,
  uniquePlace,
  type Finalized,
  type Names,
  type Score,
  type SideLock,
  type SideName,
} from "@/components/robotica/advance";
import {
  findMatch,
  findModality,
  modalities,
  type BracketModality,
  type Group,
  type Match,
  type Modality,
  type RaceEntry,
} from "@/components/robotica/data";
import { formatRace, rankRace, RACE_LIMIT_MS, PENALTY_MS, type RaceAttempt } from "@/components/robotica/race";

const STORAGE_KEY = "mdx-desafio-robotica-v1";
const PRESETS = [120, 180, 300] as const;

type Preset = (typeof PRESETS)[number];
type Phase = "idle" | "intro" | "running" | "paused" | "done";
type BracketPhase = "grupos" | "mata";
type View =
  | { name: "home" }
  | { name: "board"; modalityId: string }
  | { name: "arena"; modalityId: string; matchId: string };

type Saved = {
  scores: Record<string, Score>;
  names: Record<string, Names>;
  finalized: Finalized;
  races: Record<string, { attempts: RaceAttempt[] }>;
  preset: Preset;
};

const buttonClass =
  "cursor-pointer font-heading font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#330043] disabled:cursor-not-allowed disabled:opacity-40";

function emptySaved(): Saved {
  return { scores: {}, names: {}, finalized: {}, races: {}, preset: 120 };
}

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySaved();
    const parsed = JSON.parse(raw) as Partial<Saved> & { finalized?: unknown };
    const scores: Record<string, Score> = {};
    for (const [id, score] of Object.entries(parsed.scores ?? {})) {
      if (
        score &&
        Number.isInteger(score.home) &&
        score.home >= 0 &&
        Number.isInteger(score.away) &&
        score.away >= 0
      ) {
        scores[id] = { home: score.home, away: score.away };
      }
    }
    const names: Record<string, Names> = {};
    for (const [id, side] of Object.entries(parsed.names ?? {})) {
      if (side && typeof side.home === "string" && typeof side.away === "string") {
        names[id] = { home: side.home, away: side.away };
      }
    }
    const preset = PRESETS.find((item) => item === parsed.preset) ?? 120;
    return { scores, names, finalized: readFinalized(parsed.finalized), races: readRaces(parsed.races), preset };
  } catch {
    return emptySaved();
  }
}

function readFinalized(value: unknown): Finalized {
  const finalized: Finalized = {};
  if (Array.isArray(value)) {
    for (const id of value) if (typeof id === "string") finalized[id] = true;
    return finalized;
  }
  if (value && typeof value === "object") {
    for (const [id, on] of Object.entries(value)) if (on) finalized[id] = true;
  }
  return finalized;
}

function readRaces(value: unknown): Record<string, { attempts: RaceAttempt[] }> {
  if (!value || typeof value !== "object") return {};
  const races: Record<string, { attempts: RaceAttempt[] }> = {};
  for (const [id, run] of Object.entries(value as Record<string, { attempts?: unknown }>)) {
    if (!run || !Array.isArray(run.attempts)) continue;
    const attempts = run.attempts.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const attempt = item as RaceAttempt;
      if (!Number.isInteger(attempt.elapsedMs) || attempt.elapsedMs < 0) return [];
      if (!Number.isInteger(attempt.penalties) || attempt.penalties < 0) return [];
      if (typeof attempt.finished !== "boolean") return [];
      return [{ elapsedMs: attempt.elapsedMs, penalties: attempt.penalties, finished: attempt.finished }];
    });
    races[id] = { attempts: attempts.slice(0, 2) };
  }
  return races;
}

function formatClock(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function presetLabel(seconds: Preset): string {
  return formatClock(seconds);
}

function shown(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "A definir";
}

function scoreOf(scores: Record<string, Score>, id: string): Score {
  return scores[id] ?? { home: 0, away: 0 };
}

const serverSaved = emptySaved();
let clientSaved: Saved | null = null;
const savedListeners = new Set<() => void>();

function subscribeSaved(listener: () => void) {
  savedListeners.add(listener);
  return () => savedListeners.delete(listener);
}

function savedSnapshot(): Saved {
  if (clientSaved === null) clientSaved = loadSaved();
  return clientSaved;
}

function serverSnapshot(): Saved {
  return serverSaved;
}

function writeSaved(recipe: (current: Saved) => Saved) {
  const next = recipe(savedSnapshot());
  clientSaved = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  for (const listener of savedListeners) listener();
}

export function RoboticaBoard() {
  const saved = useSyncExternalStore(subscribeSaved, savedSnapshot, serverSnapshot);
  const { scores, names, finalized, races, preset } = saved;
  const [view, setView] = useState<View>({ name: "home" });
  const [bracketPhase, setBracketPhase] = useState<BracketPhase>("grupos");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [call, setCall] = useState<{ team: string; arena: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!call) return;
    const timeout = window.setTimeout(() => setCall(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [call]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const viewKey = view.name === "arena" ? view.matchId : view.name === "board" ? view.modalityId : "home";
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewKey]);

  function chamar(team: string, arena: string) {
    const name = team.trim();
    if (!name) return;
    setCall({ team: name, arena });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen();
  }

  function openModality(modality: Modality) {
    setBracketPhase("grupos");
    setGroupId(modality.kind === "bracket" ? modality.groups[0]?.id ?? null : null);
    setView({ name: "board", modalityId: modality.id });
  }

  function point(matchId: string, side: SideName, delta: number) {
    writeSaved((current) => {
      if (current.finalized[matchId]) return current;
      const score = current.scores[matchId] ?? { home: 0, away: 0 };
      return {
        ...current,
        scores: {
          ...current.scores,
          [matchId]: { ...score, [side]: Math.max(0, score[side] + delta) },
        },
      };
    });
  }

  function finalize(modality: BracketModality, matchId: string) {
    writeSaved((current) => {
      if (current.finalized[matchId]) return current;
      const found = findMatch(modality, matchId);
      if (!found) return current;
      const resolved = resolveBracket(modality, current.scores, current.names, current.finalized);
      const sides = sidesOf(found.match, resolved.names);
      const score = current.scores[matchId] ?? { home: 0, away: 0 };
      if (finishBlock(modality, found.match, sides, score)) return current;
      return { ...current, finalized: { ...current.finalized, [matchId]: true } };
    });
  }

  function reopen(modality: BracketModality, matchId: string) {
    writeSaved((current) => {
      if (!canReopen(modality, matchId, current.finalized)) return current;
      const next = { ...current.finalized };
      delete next[matchId];
      return { ...current, finalized: next };
    });
  }

  function rename(matchId: string, side: SideName, value: string) {
    writeSaved((current) => ({
      ...current,
      names: {
        ...current.names,
        [matchId]: {
          home: current.names[matchId]?.home ?? "",
          away: current.names[matchId]?.away ?? "",
          [side]: value,
        },
      },
    }));
  }

  function recordAttempt(teamId: string, attempt: RaceAttempt) {
    writeSaved((current) => {
      const previous = current.races?.[teamId]?.attempts ?? [];
      if (previous.length >= 2) return current;
      return {
        ...current,
        races: { ...current.races, [teamId]: { attempts: [...previous, attempt] } },
      };
    });
  }

  function undoAttempt(teamId: string) {
    writeSaved((current) => {
      const previous = current.races?.[teamId]?.attempts ?? [];
      if (previous.length === 0) return current;
      return {
        ...current,
        races: { ...current.races, [teamId]: { attempts: previous.slice(0, -1) } },
      };
    });
  }

  function choosePreset(next: Preset) {
    writeSaved((current) => ({ ...current, preset: next }));
  }

  const modality = view.name === "home" ? undefined : findModality(view.modalityId);

  return (
    <main className="min-h-dvh bg-[#F5F0FF] font-heading text-[#1E1033]">
      <div className="flex h-2" aria-hidden="true">
        <span className="flex-1 bg-[#EC4899]" />
        <span className="flex-1 bg-[#7C3AED]" />
        <span className="flex-1 bg-[#4C1D95]" />
        <span className="flex-1 bg-[#BE185D]" />
      </div>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#7C3AED] uppercase">Mermãs Digitais</p>
          <h1 className="text-2xl font-bold text-[#4C1D95] sm:text-3xl">3º Desafio de Robótica</h1>
        </div>
        <button
          type="button"
          className={cn(buttonClass, "rounded-full bg-[#4C1D95] px-4 py-3 text-sm text-white sm:text-base")}
          onClick={toggleFullscreen}
        >
          {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
        </button>
      </header>

      {view.name === "home" ? <Home onOpen={openModality} /> : null}

      {view.name === "board" && modality?.kind === "bracket" ? (
        <BracketBoard
          modality={modality}
          phase={bracketPhase}
          groupId={groupId ?? modality.groups[0]?.id ?? ""}
          scores={scores}
          names={names}
          finalized={finalized}
          onPhase={setBracketPhase}
          onGroup={setGroupId}
          onRename={rename}
          onOpen={(matchId) => setView({ name: "arena", modalityId: modality.id, matchId })}
          onBack={() => setView({ name: "home" })}
        />
      ) : null}

      {view.name === "board" && modality?.kind === "race" ? (
        <RaceBoard
          modalityName={modality.name}
          teams={modality.teams}
          races={races}
          onCall={(team) => chamar(team, modality.name)}
          onOpen={(matchId) => setView({ name: "arena", modalityId: modality.id, matchId })}
          onBack={() => setView({ name: "home" })}
        />
      ) : null}

      {view.name === "arena" && modality?.kind === "bracket" ? (
        <MatchArena
          modality={modality}
          matchId={view.matchId}
          preset={preset}
          scores={scores}
          names={names}
          finalized={finalized}
          onPreset={choosePreset}
          onPoint={point}
          onFinalize={() => finalize(modality, view.matchId)}
          onReopen={() => reopen(modality, view.matchId)}
          onCall={(team) => chamar(team, modality.name)}
          onBack={() => setView({ name: "board", modalityId: modality.id })}
        />
      ) : null}

      {view.name === "arena" && modality?.kind === "race" ? (
        <RaceArena
          modalityName={modality.name}
          team={modality.teams.find((item) => item.id === view.matchId)}
          attempts={races[view.matchId]?.attempts ?? []}
          preset={preset}
          onPreset={choosePreset}
          onRecord={(attempt) => recordAttempt(view.matchId, attempt)}
          onUndo={() => undoAttempt(view.matchId)}
          onCall={(team) => chamar(team, modality.name)}
          onBack={() => setView({ name: "board", modalityId: modality.id })}
        />
      ) : null}

      {call ? <CallOverlay team={call.team} arena={call.arena} /> : null}
    </main>
  );
}

function Home({ onOpen }: { onOpen: (modality: Modality) => void }) {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 sm:px-6">
      <p className="max-w-2xl text-lg text-[#4C1D95]">
        Escolha a modalidade. O chaveamento já está pronto para a arena.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {modalities.map((modality) => (
          <button
            key={modality.id}
            type="button"
            className={cn(
              buttonClass,
              "flex min-h-44 flex-col items-start justify-between rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-[#4C1D95]/15",
            )}
            onClick={() => onOpen(modality)}
          >
            <span className="text-3xl font-bold text-[#4C1D95]">{modality.name}</span>
            <span className="text-base font-semibold text-[#7C3AED]">{modality.blurb}</span>
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold text-[#4C1D95]/80">O placar fica salvo neste navegador.</p>
    </section>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={cn(buttonClass, "rounded-full bg-white px-4 py-2 text-sm text-[#4C1D95] ring-1 ring-[#4C1D95]/20")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function BracketBoard({
  modality,
  phase,
  groupId,
  scores,
  names,
  finalized,
  onPhase,
  onGroup,
  onRename,
  onOpen,
  onBack,
}: {
  modality: BracketModality;
  phase: BracketPhase;
  groupId: string;
  scores: Record<string, Score>;
  names: Record<string, Names>;
  finalized: Finalized;
  onPhase: (phase: BracketPhase) => void;
  onGroup: (groupId: string) => void;
  onRename: (matchId: string, side: SideName, value: string) => void;
  onOpen: (matchId: string) => void;
  onBack: () => void;
}) {
  const group = modality.groups.find((item) => item.id === groupId) ?? modality.groups[0];
  const resolved = resolveBracket(modality, scores, names, finalized);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton onClick={onBack} label="Modalidades" />
        <h2 className="text-3xl font-bold text-[#4C1D95]">{modality.name}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <PhaseButton active={phase === "grupos"} onClick={() => onPhase("grupos")}>
          Fase de grupos
        </PhaseButton>
        <PhaseButton active={phase === "mata"} onClick={() => onPhase("mata")}>
          Eliminatórias
        </PhaseButton>
      </div>

      {phase === "grupos" && group ? (
        <>
          <div className="flex flex-wrap gap-2">
            {modality.groups.map((item) => (
              <PhaseButton key={item.id} active={item.id === group.id} onClick={() => onGroup(item.id)}>
                {item.name}
              </PhaseButton>
            ))}
          </div>
          <Classification modality={modality} group={group} scores={scores} finalized={finalized} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                names={resolved.names}
                locked={resolved.locked[match.id]}
                score={scoreOf(scores, match.id)}
                sealed={Boolean(finalized[match.id])}
                onRename={onRename}
                onOpen={() => onOpen(match.id)}
              />
            ))}
          </div>
        </>
      ) : null}

      {phase === "mata" ? (
        <div className="flex flex-col gap-6">
          <p className="text-base font-semibold text-[#4C1D95]">
            As vagas entram sozinhas quando a disputa anterior é finalizada.
          </p>
          {modality.rounds.map((round) => (
            <div key={round.id} className="flex flex-col gap-3">
              <h3 className="text-xl font-bold text-[#7C3AED]">{round.name}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {round.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    names={resolved.names}
                    locked={resolved.locked[match.id]}
                    score={scoreOf(scores, match.id)}
                    sealed={Boolean(finalized[match.id])}
                    onRename={onRename}
                    onOpen={() => onOpen(match.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PhaseButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        buttonClass,
        "rounded-full px-4 py-2 text-base",
        active ? "bg-[#4C1D95] text-white" : "bg-white text-[#4C1D95] ring-1 ring-[#4C1D95]/20",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MatchCard({
  match,
  names,
  locked,
  score,
  sealed,
  onRename,
  onOpen,
}: {
  match: Match;
  names: Record<string, Names>;
  locked?: SideLock;
  score: Score;
  sealed: boolean;
  onRename: (matchId: string, side: SideName, value: string) => void;
  onOpen: () => void;
}) {
  const sides = sidesOf(match, names);
  const homeLeads = score.home > score.away;
  const awayLeads = score.away > score.home;

  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#4C1D95]/15">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold tracking-wide text-[#7C3AED] uppercase">{match.label}</p>
        <p className="text-lg font-bold tabular-nums text-[#4C1D95]">
          {score.home} × {score.away}
        </p>
      </div>
      <SideLine
        match={match}
        side="home"
        name={sides.home}
        leading={homeLeads}
        locked={Boolean(locked?.home)}
        onRename={onRename}
      />
      <SideLine
        match={match}
        side="away"
        name={sides.away}
        leading={awayLeads}
        locked={Boolean(locked?.away)}
        onRename={onRename}
      />
      {sealed ? <p className="text-sm font-bold text-[#15803D]">Finalizada</p> : null}
      <button
        type="button"
        className={cn(buttonClass, "mt-auto rounded-2xl bg-[#EC4899] px-4 py-3 text-base text-white")}
        onClick={onOpen}
      >
        Abrir arena
      </button>
    </article>
  );
}

function SideLine({
  match,
  side,
  name,
  leading,
  locked,
  onRename,
}: {
  match: Match;
  side: SideName;
  name: string;
  leading: boolean;
  locked: boolean;
  onRename: (matchId: string, side: SideName, value: string) => void;
}) {
  if (!match.editable || locked) {
    return <p className={cn("text-lg font-bold", leading ? "text-[#15803D]" : "text-[#1E1033]")}>{shown(name)}</p>;
  }
  return (
    <NameField
      label={`${match.label}, ${side === "home" ? "primeira" : "segunda"} equipe`}
      value={name}
      leading={leading}
      onChange={(value) => onRename(match.id, side, value)}
    />
  );
}

function Classification({
  modality,
  group,
  scores,
  finalized,
}: {
  modality: BracketModality;
  group: Group;
  scores: Record<string, Score>;
  finalized: Finalized;
}) {
  const rows = standings(group, scores, finalized);
  const places = qualifyCount(modality);
  const closed = groupClosed(group, finalized);
  const slots = Array.from({ length: places }, (_, place) => uniquePlace(rows, place));
  const status = !closed
    ? `Passam as ${places} primeiras quando o grupo fechar`
    : slots.every(Boolean)
      ? `As ${places} primeiras estão nas quartas`
      : "Empate em pontos. A comissão define as vagas empatadas.";

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#4C1D95]/15">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-[#4C1D95]">Classificação · {group.name}</h3>
        <p className="text-sm font-semibold text-[#7C3AED]">{status}</p>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row, index) => (
          <li key={row.team} className="flex items-center gap-3 rounded-2xl bg-[#F5F0FF] px-3 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#4C1D95] text-sm font-bold text-white">
              {tablePlace(rows, index)}º
            </span>
            <span className="min-w-0 flex-1 font-bold">{row.team}</span>
            <span className="text-sm font-bold tabular-nums text-[#4C1D95]">{row.points} pts</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm font-semibold text-[#4C1D95]/80">
        Vitória na disputa vale 3, empate vale 1. Empate em pontos fica com a comissão.
      </p>
    </div>
  );
}

function NameField({
  label,
  value,
  leading,
  onChange,
}: {
  label: string;
  value: string;
  leading: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      placeholder="Nome da equipe"
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "w-full rounded-xl border-2 bg-white px-3 py-2 text-lg font-semibold outline-none focus:border-[#7C3AED]",
        leading ? "border-[#16A34A] text-[#15803D]" : "border-[#4C1D95]/20 text-[#1E1033]",
      )}
    />
  );
}

function RaceBoard({
  modalityName,
  teams,
  races,
  onCall,
  onOpen,
  onBack,
}: {
  modalityName: string;
  teams: RaceEntry[];
  races: Record<string, { attempts: RaceAttempt[] }>;
  onCall: (team: string) => void;
  onOpen: (matchId: string) => void;
  onBack: () => void;
}) {
  const ranking = rankRace(teams, races).filter((item) => item.place !== null);
  const byId = new Map(rankRace(teams, races).map((item) => [item.id, item]));

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton onClick={onBack} label="Modalidades" />
        <h2 className="text-3xl font-bold text-[#4C1D95]">{modalityName}</h2>
      </div>
      <p className="text-base font-semibold text-[#4C1D95]">
        Classificação pelo menor tempo. Cada toque soma 5 segundos. Duas tentativas; vale a melhor.
      </p>
      {ranking.length > 0 ? (
        <ol className="grid gap-2 sm:grid-cols-2">
          {ranking.map((item) => {
            const team = teams.find((entry) => entry.id === item.id);
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#4C1D95] text-sm font-bold text-white">
                  {item.place}º
                </span>
                <span className="min-w-0 flex-1 font-bold">{team?.name}</span>
                <span className="text-sm font-bold tabular-nums text-[#4C1D95]">
                  {item.bestMs === null ? "" : formatRace(item.bestMs)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="text-base font-semibold text-[#4C1D95]">Ordem de largada</p>
      <ol className="flex flex-col gap-3">
        {teams.map((team) => (
          <li key={team.id} className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-[#4C1D95]/15 sm:flex-nowrap sm:p-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#4C1D95] text-2xl font-bold text-white">
              {team.order}
            </span>
            <span className="min-w-0 flex-1 text-xl font-bold sm:text-2xl">
              {team.name}
              {byId.get(team.id)?.bestMs !== null && byId.get(team.id)?.bestMs !== undefined ? (
                <span className="mt-1 block text-sm font-semibold text-[#7C3AED]">
                  {byId.get(team.id)?.place}º · {formatRace(byId.get(team.id)?.bestMs ?? 0)}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className={cn(buttonClass, "rounded-2xl bg-[#4C1D95] px-4 py-3 text-base text-white")}
              onClick={() => onCall(team.name)}
            >
              Chamar
            </button>
            <button
              type="button"
              className={cn(buttonClass, "rounded-2xl bg-[#EC4899] px-4 py-3 text-base text-white")}
              onClick={() => onOpen(team.id)}
            >
              Arena
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MatchArena({
  modality,
  matchId,
  preset,
  scores,
  names,
  finalized,
  onPreset,
  onPoint,
  onFinalize,
  onReopen,
  onCall,
  onBack,
}: {
  modality: BracketModality;
  matchId: string;
  preset: Preset;
  scores: Record<string, Score>;
  names: Record<string, Names>;
  finalized: Finalized;
  onPreset: (preset: Preset) => void;
  onPoint: (matchId: string, side: SideName, delta: number) => void;
  onFinalize: () => void;
  onReopen: () => void;
  onCall: (team: string) => void;
  onBack: () => void;
}) {
  const found = findMatch(modality, matchId);
  if (!found) {
    return (
      <section className="px-6 pb-10">
        <BackButton onClick={onBack} label="Voltar ao chaveamento" />
        <p className="mt-4 text-lg font-semibold">Essa disputa não está no chaveamento.</p>
      </section>
    );
  }

  const { match, context } = found;
  const resolved = resolveBracket(modality, scores, names, finalized);
  const sides = sidesOf(match, resolved.names);
  const score = scoreOf(scores, match.id);
  const sealed = Boolean(finalized[match.id]);
  const block = sealed ? null : finishBlock(modality, match, sides, score);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton onClick={onBack} label="Voltar ao chaveamento" />
        <p className="text-lg font-bold text-[#7C3AED]">
          {context} · {match.label}
        </p>
        {sealed ? <p className="text-lg font-bold text-[#15803D]">Finalizada</p> : null}
      </div>
      <p className="text-sm font-semibold text-[#4C1D95]">
        {isGroupMatch(modality, match.id)
          ? "Cada número é um round. Quem vencer mais rounds ganha a disputa e leva 3 pontos."
          : "Cada número é um round. Só avança quem vencer a disputa."}
      </p>
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_18rem_minmax(0,1fr)]">
        <TeamSide
          name={sides.home}
          score={score.home}
          leading={score.home > score.away}
          sealed={sealed}
          onCall={() => onCall(sides.home)}
          onAdd={() => onPoint(match.id, "home", 1)}
          onRemove={() => onPoint(match.id, "home", -1)}
        />
        <ClockPanel preset={preset} onPreset={onPreset} />
        <TeamSide
          name={sides.away}
          score={score.away}
          leading={score.away > score.home}
          sealed={sealed}
          onCall={() => onCall(sides.away)}
          onAdd={() => onPoint(match.id, "away", 1)}
          onRemove={() => onPoint(match.id, "away", -1)}
        />
      </div>
      <FinishBar
        sealed={sealed}
        note={sealed ? resultNote(modality, match.id, scores, resolved.names, finalized) : null}
        block={block}
        canReopen={canReopen(modality, match.id, finalized)}
        onFinalize={onFinalize}
        onReopen={onReopen}
      />
    </section>
  );
}

function FinishBar({
  sealed,
  note,
  block,
  canReopen: reopenable,
  onFinalize,
  onReopen,
}: {
  sealed: boolean;
  note: string | null;
  block: string | null;
  canReopen: boolean;
  onFinalize: () => void;
  onReopen: () => void;
}) {
  if (sealed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-4 py-5 text-center">
        <p className="text-xl font-bold text-[#15803D]">{note}</p>
        {reopenable ? (
          <button
            type="button"
            className={cn(buttonClass, "rounded-2xl bg-[#F5F0FF] px-5 py-3 text-base text-[#4C1D95]")}
            onClick={onReopen}
          >
            Reabrir disputa
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        className={cn(buttonClass, "w-full rounded-3xl bg-[#EC4899] px-6 py-5 text-2xl text-white sm:w-auto sm:min-w-80")}
        onClick={onFinalize}
        disabled={Boolean(block)}
      >
        Finalizar disputa
      </button>
      {block ? <p className="text-center text-base font-semibold text-[#4C1D95]">{block}</p> : null}
    </div>
  );
}

function TeamSide({
  name,
  score,
  leading,
  sealed,
  onCall,
  onAdd,
  onRemove,
}: {
  name: string;
  score: number;
  leading: boolean;
  sealed: boolean;
  onCall: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const label = shown(name);
  const callable = name.trim().length > 0;

  return (
    <article
      className={cn(
        "flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-sm ring-4 sm:p-6",
        leading ? "ring-[#16A34A]" : "ring-[#4C1D95]/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-3xl font-bold leading-tight text-[#1E1033] sm:text-4xl">{label}</h2>
        <button
          type="button"
          className={cn(buttonClass, "shrink-0 rounded-2xl bg-[#4C1D95] px-4 py-3 text-base text-white")}
          onClick={onCall}
          disabled={!callable}
        >
          Chamar
        </button>
      </div>
      <div className="mt-auto flex items-center justify-center gap-4">
        <p className="min-w-[2ch] text-center text-7xl font-bold tabular-nums leading-none text-[#1E1033] sm:text-8xl">
          {score}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={cn(buttonClass, "h-16 min-w-20 rounded-2xl bg-[#16A34A] text-3xl text-white")}
            onClick={onAdd}
            disabled={sealed}
            aria-label={`Marcar ponto para ${label}`}
          >
            +1
          </button>
          <button
            type="button"
            className={cn(buttonClass, "h-16 min-w-20 rounded-2xl bg-[#DC2626] text-3xl text-white")}
            onClick={onRemove}
            disabled={sealed || score === 0}
            aria-label={`Tirar ponto de ${label}`}
          >
            −1
          </button>
        </div>
      </div>
    </article>
  );
}

function RaceArena({
  modalityName,
  team,
  attempts,
  preset,
  onPreset,
  onRecord,
  onUndo,
  onCall,
  onBack,
}: {
  modalityName: string;
  team: RaceEntry | undefined;
  attempts: RaceAttempt[];
  preset: Preset;
  onPreset: (preset: Preset) => void;
  onRecord: (attempt: RaceAttempt) => void;
  onUndo: () => void;
  onCall: (team: string) => void;
  onBack: () => void;
}) {
  if (!team) {
    return (
      <section className="px-6 pb-10">
        <BackButton onClick={onBack} label="Voltar à ordem" />
        <p className="mt-4 text-lg font-semibold">Essa equipe não está na ordem de largada.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton onClick={onBack} label="Voltar à ordem" />
        <p className="text-lg font-bold text-[#7C3AED]">
          {modalityName} · Largada {team.order}
        </p>
      </div>
      <article className="flex flex-col items-center gap-6 rounded-3xl bg-white p-8 text-center shadow-sm">
        <h2 className="text-4xl font-bold text-[#1E1033] sm:text-6xl">{team.name}</h2>
        <button
          type="button"
          className={cn(buttonClass, "rounded-2xl bg-[#4C1D95] px-6 py-4 text-xl text-white")}
          onClick={() => onCall(team.name)}
        >
          Chamar
        </button>
      </article>
      <ClockPanel
        preset={preset}
        onPreset={onPreset}
        footer={(clock) => (
          <RaceAttemptBar
            attempts={attempts}
            phase={clock.phase}
            remaining={clock.remaining}
            preset={preset}
            onRecord={onRecord}
            onUndo={onUndo}
          />
        )}
      />
    </section>
  );
}

function RaceAttemptBar({
  attempts,
  phase,
  remaining,
  preset,
  onRecord,
  onUndo,
}: {
  attempts: RaceAttempt[];
  phase: Phase;
  remaining: number;
  preset: Preset;
  onRecord: (attempt: RaceAttempt) => void;
  onUndo: () => void;
}) {
  const [penalties, setPenalties] = useState(0);
  const full = attempts.length >= 2;
  const ready = phase === "running" || phase === "paused" || phase === "done";

  function register() {
    if (!ready || full) return;
    const finished = phase !== "done";
    const elapsedMs = finished ? Math.max(0, (preset - remaining) * 1000) : Math.min(preset * 1000, RACE_LIMIT_MS);
    onRecord({
      elapsedMs: finished ? elapsedMs : RACE_LIMIT_MS,
      penalties,
      finished,
    });
    setPenalties(0);
  }

  return (
    <div className="flex w-full flex-col gap-3 text-white">
      <p className="text-center text-sm font-semibold">
        Tentativa {Math.min(attempts.length + 1, 2)} de 2 · toque soma {PENALTY_MS / 1000}s
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className={cn(buttonClass, "rounded-2xl bg-white px-2 py-3 text-base text-[#4C1D95]")}
          onClick={() => setPenalties((count) => count + 1)}
        >
          + toque
        </button>
        <p className="grid place-items-center text-2xl font-bold tabular-nums">{penalties}</p>
        <button
          type="button"
          className={cn(buttonClass, "rounded-2xl bg-white/15 px-2 py-3 text-base")}
          onClick={() => setPenalties((count) => Math.max(0, count - 1))}
          disabled={penalties === 0}
        >
          − toque
        </button>
      </div>
      <button
        type="button"
        className={cn(buttonClass, "rounded-2xl bg-[#EC4899] px-3 py-3 text-base")}
        onClick={register}
        disabled={!ready || full}
      >
        Registrar tentativa
      </button>
      {attempts.length > 0 ? (
        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
          <p>
            {attempts.map((attempt, index) => `${index + 1}ª ${formatRace(attempt.finished ? attempt.elapsedMs + attempt.penalties * PENALTY_MS : RACE_LIMIT_MS)}`).join(" · ")}
          </p>
          <button type="button" className={cn(buttonClass, "rounded-xl bg-white/15 px-3 py-2")} onClick={onUndo}>
            Apagar última
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ClockPanel({
  preset,
  onPreset,
  footer,
}: {
  preset: Preset;
  onPreset: (preset: Preset) => void;
  footer?: (clock: { phase: Phase; remaining: number }) => React.ReactNode;
}) {
  const clock = useArenaClock(preset, onPreset);
  const face = clock.phase === "intro" ? String(clock.intro) : clock.phase === "done" ? "TEMPO" : formatClock(clock.remaining);
  const caption =
    clock.phase === "intro" ? "Começa em" : clock.phase === "paused" ? "Pausado" : clock.phase === "done" ? "Encerrado" : "Cronômetro";

  return (
    <section className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-[#4C1D95] px-4 py-6 text-white">
      <p className="text-sm font-semibold tracking-[0.16em] uppercase">{caption}</p>
      <p
        className={cn(
          "text-center text-6xl font-bold tabular-nums leading-none sm:text-7xl",
          clock.phase === "done" && "text-[#EC4899]",
        )}
      >
        {face}
      </p>
      <div className="grid w-full grid-cols-3 gap-2">
        {PRESETS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            className={cn(
              buttonClass,
              "rounded-2xl px-2 py-3 text-lg",
              preset === seconds ? "bg-[#EC4899] text-white" : "bg-white/15 text-white",
            )}
            onClick={() => clock.choose(seconds)}
          >
            {presetLabel(seconds)}
          </button>
        ))}
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        {clock.phase === "paused" ? (
          <button
            type="button"
            className={cn(buttonClass, "rounded-2xl bg-white px-3 py-3 text-base text-[#4C1D95]")}
            onClick={clock.resume}
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            className={cn(buttonClass, "rounded-2xl bg-white px-3 py-3 text-base text-[#4C1D95]")}
            onClick={clock.pause}
            disabled={clock.phase !== "running"}
          >
            Pausar
          </button>
        )}
        <button
          type="button"
          className={cn(buttonClass, "rounded-2xl bg-white/15 px-3 py-3 text-base text-white")}
          onClick={clock.restart}
          disabled={clock.phase === "idle"}
        >
          Recomeçar
        </button>
      </div>
      {footer ? footer({ phase: clock.phase, remaining: clock.remaining }) : null}
    </section>
  );
}

function useArenaClock(preset: Preset, onPreset: (preset: Preset) => void) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [intro, setIntro] = useState(3);
  const [run, setRun] = useState(0);
  const [remaining, setRemaining] = useState(preset);
  const durationRef = useRef<Preset>(preset);
  const endsAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "intro") return;
    const timeout = window.setTimeout(() => {
      if (intro <= 1) {
        const duration = durationRef.current;
        endsAtRef.current = Date.now() + duration * 1000;
        setRemaining(duration);
        setIntro(3);
        setPhase("running");
        return;
      }
      setIntro(intro - 1);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [phase, intro, run]);

  useEffect(() => {
    if (phase !== "running") return;
    const interval = window.setInterval(() => {
      const endsAt = endsAtRef.current;
      if (endsAt === null) return;
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        endsAtRef.current = null;
        setPhase("done");
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [phase]);

  function choose(seconds: Preset) {
    durationRef.current = seconds;
    endsAtRef.current = null;
    onPreset(seconds);
    setRemaining(seconds);
    setIntro(3);
    setPhase("intro");
    setRun((current) => current + 1);
  }

  function pause() {
    if (phase !== "running" || endsAtRef.current === null) return;
    const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
    endsAtRef.current = null;
    setRemaining(left);
    setPhase("paused");
  }

  function resume() {
    if (phase !== "paused") return;
    endsAtRef.current = Date.now() + remaining * 1000;
    setPhase("running");
  }

  function restart() {
    endsAtRef.current = null;
    setIntro(3);
    setRemaining(durationRef.current);
    setPhase("idle");
  }

  const shownRemaining = phase === "idle" ? preset : remaining;

  return { phase, intro, remaining: shownRemaining, choose, pause, resume, restart };
}

function CallOverlay({ team, arena }: { team: string; arena: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1033] px-8"
      role="status"
      aria-live="assertive"
    >
      <p className="max-w-6xl text-center text-4xl font-bold leading-tight text-white sm:text-6xl lg:text-7xl">
        Equipe {team} comparecer na arena de {arena}
      </p>
    </div>
  );
}
