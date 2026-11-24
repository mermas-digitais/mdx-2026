import type { BracketModality, Group, Match } from "@/components/robotica/data";

export type SideName = "home" | "away";
export type Score = { home: number; away: number };
export type Names = { home: string; away: string };
export type Finalized = Record<string, true>;
export type Standing = {
  team: string;
  points: number;
};
export type SideLock = { home: boolean; away: boolean };

type Seed = { group: number; place: number };
type Slot = { id: string; side: SideName };

export function qualifyCount(modality: BracketModality): number {
  if (modality.groups.length === 0) return 0;
  return Math.floor(8 / modality.groups.length);
}

export function isGroupMatch(modality: BracketModality, matchId: string): boolean {
  return modality.groups.some((group) => group.matches.some((match) => match.id === matchId));
}

export function groupClosed(group: Group, finalized: Finalized): boolean {
  return group.matches.length > 0 && group.matches.every((match) => finalized[match.id]);
}

export function standings(group: Group, scores: Record<string, Score>, finalized: Finalized): Standing[] {
  const table = new Map<string, Standing>(group.teams.map((team) => [team, { team, points: 0 }]));

  for (const match of group.matches) {
    if (!finalized[match.id]) continue;
    const score = scores[match.id] ?? { home: 0, away: 0 };
    const home = table.get(match.home);
    const away = table.get(match.away);
    if (!home || !away) continue;
    if (score.home > score.away) home.points += 3;
    else if (score.away > score.home) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  return [...table.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.team.localeCompare(b.team, "pt");
  });
}

export function tablePlace(rows: Standing[], index: number): number {
  const points = rows[index]?.points;
  return rows.findIndex((row) => row.points === points) + 1;
}

export function uniquePlace(rows: Standing[], place: number): string | null {
  const row = rows[place];
  if (!row) return null;
  if (rows.some((item, index) => index !== place && item.points === row.points)) return null;
  return row.team;
}

export function sidesOf(match: Match, resolved: Record<string, Names>): Names {
  if (!match.editable) return { home: match.home, away: match.away };
  return resolved[match.id] ?? { home: "", away: "" };
}

export function resolveBracket(
  modality: BracketModality,
  scores: Record<string, Score>,
  manual: Record<string, Names>,
  finalized: Finalized,
): { names: Record<string, Names>; locked: Record<string, SideLock> } {
  const names: Record<string, Names> = {};
  const locked: Record<string, SideLock> = {};
  for (const round of modality.rounds) {
    for (const match of round.matches) {
      names[match.id] = {
        home: manual[match.id]?.home ?? "",
        away: manual[match.id]?.away ?? "",
      };
      locked[match.id] = { home: false, away: false };
    }
  }

  const rankings = modality.groups.map((group) =>
    groupClosed(group, finalized) ? standings(group, scores, finalized) : null,
  );
  const quarters = modality.rounds[0]?.matches ?? [];
  quarterSeeds(modality.groups.length).forEach((seed, index) => {
    const match = quarters[index];
    if (!seed || !match) return;
    placeSeed(names, locked, match.id, "home", rankings, seed.home);
    placeSeed(names, locked, match.id, "away", rankings, seed.away);
  });

  const prefix = prefixOf(modality);
  for (const suffix of ["qf-1", "qf-2", "qf-3", "qf-4", "sf-1", "sf-2"]) {
    const id = `${prefix}-${suffix}`;
    if (!finalized[id]) continue;
    const score = scores[id] ?? { home: 0, away: 0 };
    const sides = names[id];
    if (!sides || score.home === score.away) continue;
    const winner = score.home > score.away ? sides.home : sides.away;
    const loser = score.home > score.away ? sides.away : sides.home;
    const feed = progression(prefix)[id];
    if (feed?.winner && winner.trim()) writeSlot(names, locked, feed.winner, winner.trim());
    if (feed?.loser && loser.trim()) writeSlot(names, locked, feed.loser, loser.trim());
  }

  return { names, locked };
}

export function finishBlock(modality: BracketModality, match: Match, sides: Names, score: Score): string | null {
  if (!sides.home.trim() || !sides.away.trim()) return "As duas equipes precisam estar na disputa.";
  if (!isGroupMatch(modality, match.id) && score.home === score.away) {
    return "Empate não avança. Se continuar assim, o regulamento pede o round especial.";
  }
  return null;
}

export function canReopen(modality: BracketModality, matchId: string, finalized: Finalized): boolean {
  if (!finalized[matchId]) return false;
  if (isGroupMatch(modality, matchId)) {
    return !(modality.rounds[0]?.matches.some((match) => finalized[match.id]) ?? false);
  }
  const feed = progression(prefixOf(modality))[matchId];
  if (!feed) return true;
  if (feed.winner && finalized[feed.winner.id]) return false;
  if (feed.loser && finalized[feed.loser.id]) return false;
  return true;
}

export function resultNote(
  modality: BracketModality,
  matchId: string,
  scores: Record<string, Score>,
  resolved: Record<string, Names>,
  finalized: Finalized,
): string {
  const group = modality.groups.find((item) => item.matches.some((match) => match.id === matchId));
  if (group) {
    if (!groupClosed(group, finalized)) {
      const left = group.matches.filter((match) => !finalized[match.id]).length;
      const label = left === 1 ? "falta 1 disputa" : `faltam ${left} disputas`;
      return `Placar cravado. Ainda ${label} para fechar o ${group.name}.`;
    }
    const rows = standings(group, scores, finalized);
    const slots = Array.from({ length: qualifyCount(modality) }, (_, place) => uniquePlace(rows, place));
    const placed = slots.flatMap((team, index) => (team ? [`${index + 1}º ${team}`] : []));
    if (placed.length === slots.length) return `Placar cravado. ${placed.join(", ")} foram para as quartas.`;
    if (placed.length === 0) return "Placar cravado. Empate em pontos: a comissão define quem passa.";
    return `Placar cravado. ${placed.join(", ")} foram para as quartas. As vagas empatadas ficam com a comissão.`;
  }

  const score = scores[matchId] ?? { home: 0, away: 0 };
  const sides = resolved[matchId] ?? { home: "", away: "" };
  const winner = score.home > score.away ? sides.home : sides.away;
  const loser = score.home > score.away ? sides.away : sides.home;
  const feed = progression(prefixOf(modality))[matchId];
  if (feed?.loser) return `Placar cravado. ${winner} está na final e ${loser} disputa o terceiro lugar.`;
  if (feed?.winner) return `Placar cravado. ${winner} está na semifinal.`;
  if (matchId.endsWith("final-1")) return `Placar cravado. ${winner} é a campeã.`;
  return `Placar cravado. ${winner} fica em terceiro.`;
}

function prefixOf(modality: BracketModality): string {
  return modality.rounds[0]?.matches[0]?.id.split("-")[0] ?? "";
}

function quarterSeeds(groupCount: number): Array<{ home: Seed; away: Seed } | null> {
  if (groupCount === 4) {
    return [
      { home: { group: 0, place: 0 }, away: { group: 1, place: 1 } },
      { home: { group: 2, place: 0 }, away: { group: 3, place: 1 } },
      { home: { group: 1, place: 0 }, away: { group: 0, place: 1 } },
      { home: { group: 3, place: 0 }, away: { group: 2, place: 1 } },
    ];
  }
  if (groupCount === 2) {
    return [
      { home: { group: 0, place: 0 }, away: { group: 1, place: 3 } },
      { home: { group: 1, place: 1 }, away: { group: 0, place: 2 } },
      { home: { group: 1, place: 0 }, away: { group: 0, place: 3 } },
      { home: { group: 0, place: 1 }, away: { group: 1, place: 2 } },
    ];
  }
  return [];
}

function progression(prefix: string): Record<string, { winner?: Slot; loser?: Slot }> {
  return {
    [`${prefix}-qf-1`]: { winner: { id: `${prefix}-sf-1`, side: "home" } },
    [`${prefix}-qf-2`]: { winner: { id: `${prefix}-sf-1`, side: "away" } },
    [`${prefix}-qf-3`]: { winner: { id: `${prefix}-sf-2`, side: "home" } },
    [`${prefix}-qf-4`]: { winner: { id: `${prefix}-sf-2`, side: "away" } },
    [`${prefix}-sf-1`]: {
      winner: { id: `${prefix}-final-1`, side: "home" },
      loser: { id: `${prefix}-terceiro-1`, side: "home" },
    },
    [`${prefix}-sf-2`]: {
      winner: { id: `${prefix}-final-1`, side: "away" },
      loser: { id: `${prefix}-terceiro-1`, side: "away" },
    },
  };
}

function placeSeed(
  names: Record<string, Names>,
  locked: Record<string, SideLock>,
  matchId: string,
  side: SideName,
  rankings: Array<Standing[] | null>,
  seed: Seed,
) {
  const ranking = rankings[seed.group];
  const team = ranking ? uniquePlace(ranking, seed.place) : null;
  if (!team) return;
  writeSlot(names, locked, { id: matchId, side }, team);
}

function writeSlot(names: Record<string, Names>, locked: Record<string, SideLock>, slot: Slot, team: string) {
  const current = names[slot.id] ?? { home: "", away: "" };
  names[slot.id] = { ...current, [slot.side]: team };
  const lock = locked[slot.id] ?? { home: false, away: false };
  locked[slot.id] = { ...lock, [slot.side]: true };
}
