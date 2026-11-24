export type RaceAttempt = {
  elapsedMs: number;
  penalties: number;
  finished: boolean;
};

export const RACE_LIMIT_MS = 180_000;
export const PENALTY_MS = 5_000;

export function attemptTotal(attempt: RaceAttempt): number {
  if (!attempt.finished) return RACE_LIMIT_MS;
  return attempt.elapsedMs + attempt.penalties * PENALTY_MS;
}

export type RaceRank = {
  id: string;
  place: number | null;
  bestMs: number | null;
  penalties: number | null;
};

export function rankRace(
  teams: { id: string; order: number }[],
  races: Record<string, { attempts: RaceAttempt[] }>,
): RaceRank[] {
  const scored = teams.map((team) => {
    const attempts = (races[team.id]?.attempts ?? []).map((attempt) => ({
      total: attemptTotal(attempt),
      penalties: attempt.penalties,
    }));
    attempts.sort((a, b) => a.total - b.total || a.penalties - b.penalties);
    return {
      id: team.id,
      order: team.order,
      best: attempts[0] ?? null,
      second: attempts[1]?.total ?? Number.POSITIVE_INFINITY,
    };
  });

  scored.sort((a, b) => {
    if (!a.best && !b.best) return a.order - b.order;
    if (!a.best) return 1;
    if (!b.best) return -1;
    if (a.best.total !== b.best.total) return a.best.total - b.best.total;
    if (a.best.penalties !== b.best.penalties) return a.best.penalties - b.best.penalties;
    if (a.second !== b.second) return a.second - b.second;
    return a.order - b.order;
  });

  let lastPlace = 0;
  return scored.map((team, index) => {
    if (!team.best) return { id: team.id, place: null, bestMs: null, penalties: null };
    const previous = scored[index - 1];
    const tied = Boolean(
      previous?.best &&
        previous.best.total === team.best.total &&
        previous.best.penalties === team.best.penalties &&
        previous.second === team.second,
    );
    const place = tied ? lastPlace : index + 1;
    lastPlace = place;
    return { id: team.id, place, bestMs: team.best.total, penalties: team.best.penalties };
  });
}

export function formatRace(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
