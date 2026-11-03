"use client";

import { useEffect, useState } from "react";

export function Countdown({
  startsAt,
  endsAt,
  tone = "light",
}: {
  startsAt: string | null;
  endsAt: string | null;
  tone?: "light" | "glass";
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!startsAt || now === null) return null;
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (Number.isNaN(start)) return null;

  const ink = tone === "glass" ? "text-white" : "text-[#330043]";

  if (now >= start && (end === null || now < end)) {
    return <p className={`font-heading text-lg font-bold ${ink}`}>O evento está acontecendo.</p>;
  }
  if (end !== null && now >= end) {
    return <p className={`font-heading text-lg font-bold ${ink}`}>O evento já terminou.</p>;
  }

  const totalSeconds = Math.max(0, Math.floor((start - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const units = [
    [days, "dias"],
    [hours, "horas"],
    [minutes, "minutos"],
    [seconds, "segundos"],
  ] as const;

  return (
    <div className={tone === "glass" ? "w-full max-w-xl" : undefined}>
      <p className="sr-only">
        Contagem regressiva. Faltam {days} dias, {hours} horas, {minutes} minutos e {seconds} segundos.
      </p>
      <div className={tone === "glass" ? "grid w-full grid-cols-4 gap-1.5 sm:gap-3" : "flex items-end gap-2"} aria-hidden="true">
        {units.map(([value, label]) => (
          <div
            key={label}
            className={
              tone === "glass"
                ? "flex min-w-0 flex-col items-center rounded-2xl border border-white/40 bg-white/20 px-1 py-3 md:rounded-3xl md:px-3 md:py-5"
                : "flex min-w-[4.5rem] flex-col items-center rounded-2xl bg-white px-3 py-3 shadow-[0_8px_0_#F5D0FE]"
            }
          >
            <span
              className={`font-heading leading-none font-bold tabular-nums ${
                tone === "glass" ? "text-3xl text-white md:text-5xl lg:text-6xl" : "text-4xl text-[#6D28D9]"
              }`}
            >
              {value}
            </span>
            <span
              className={`mt-2 text-[0.65rem] sm:text-xs ${tone === "glass" ? "text-white/90 md:text-sm" : "font-bold tracking-wide text-[#7C3AED] uppercase"}`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
