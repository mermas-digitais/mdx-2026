import Link from "next/link";
import { Erica_One, Paytone_One } from "next/font/google";
import { Countdown } from "@/components/public/countdown";
import { Schedule, type PublicActivity } from "@/components/public/schedule";
import type { PublicEvent } from "@/lib/api";
import { eventTimeZone, formatFortalezaDay, fortalezaDay } from "@/server/event-schema";

const paytone = Paytone_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const erica = Erica_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const participation = [
  { name: "Gamificações", icon: "game", general: true, girls: true },
  { name: "Sorteios", icon: "gift", general: true, girls: true },
  { name: "Conhecer os stands", icon: "stand", general: true, girls: true },
  { name: "Participar das atividades interativas", icon: "idea", general: true, girls: true },
  { name: "Competir no desafio de robótica", icon: "bot", general: false, girls: true },
] as const;

const happenings = [
  { title: "Robótica", text: "Monte, programe e veja suas ideias ganharem vida.", icon: "/marca/robo.png", background: "#EDE9FE" },
  { title: "Programação", text: "Lógica, código e criação na prática.", icon: "/marca/selo-steam.png", background: "#FCE7F3" },
  { title: "Jogos", text: "Diversão e tecnologia andam juntas.", icon: "/marca/controle.png", background: "#FEF3C7" },
  { title: "Projetos", text: "Invenções e soluções para um futuro melhor.", icon: "/marca/estrela.png", background: "#DCFCE7" },
  { title: "Palestras", text: "Inspiração com pessoas incríveis da área.", icon: "/marca/trofeu.png", background: "#FCE7F3" },
  { title: "Experiências STEAM", text: "Ciência, tecnologia, engenharia, artes e matemática.", icon: "/marca/desafio.png", background: "#EDE9FE" },
] as const;

const notebookFrame = { width: 578, height: 647 };

const notebookIcons = [
  { src: "/marca/robo-sozinho.svg", delay: "0s", x: 0, y: 165, width: 73, height: 76 },
  { src: "/marca/steam-sozinho.svg", delay: "0.5s", x: 78, y: 37, width: 159, height: 84 },
  { src: "/marca/lampada-sozinho.svg", delay: "1s", x: 316, y: 0, width: 68, height: 70 },
  { src: "/marca/codigo-sozinho.svg", delay: "1.5s", x: 428, y: 60, width: 89, height: 77 },
  { src: "/marca/selo-sozinho.svg", delay: "2s", x: 442, y: 300, width: 136, height: 137 },
  { src: "/marca/game-sozinho.svg", delay: "2.5s", x: 402, y: 469, width: 115, height: 71 },
] as const;

function frameBox(x: number, y: number, width: number, height: number) {
  return {
    left: `${(x / notebookFrame.width) * 100}%`,
    top: `${(y / notebookFrame.height) * 100}%`,
    width: `${(width / notebookFrame.width) * 100}%`,
    height: `${(height / notebookFrame.height) * 100}%`,
  };
}

function NotebookScene() {
  return (
    <div className="relative mx-auto aspect-[578/647] w-full max-w-md">
      <img
        src="/marca/menina-notebook-sozinha.svg"
        alt=""
        className="absolute"
        style={frameBox(40, 42, 460, 605)}
      />
      {notebookIcons.map((icon) => (
        <span
          key={icon.src}
          className="mdx-float absolute"
          style={{ ...frameBox(icon.x, icon.y, icon.width, icon.height), animationDelay: icon.delay }}
        >
          <img
            src={icon.src}
            alt=""
            className="h-full w-full object-contain transition-transform duration-300 hover:scale-[1.12]"
          />
        </span>
      ))}
    </div>
  );
}

export function EventHome({ event }: { event: PublicEvent }) {
  const signupHref = `/e/${event.slug}/inscricao`;
  const locations = event.locations ?? [];
  const activities = withLocations(event.activities ?? [], locations);
  const announcements = event.announcements ?? [];
  const rules = event.rules ?? [];
  const mapQuery = event.address || event.place;

  return (
    <main className="overflow-x-hidden bg-[#FFF7FC] text-[#330043]">
      {event.preview ? (
        <p role="status" className="bg-[#FFCD34] px-4 py-3 text-center font-bold">
          Este evento ainda é um rascunho. Só a organização vê esta página.
        </p>
      ) : null}

      <section
        aria-label={event.title}
        className="relative h-[70svh] w-full overflow-hidden bg-cover bg-center md:h-[calc(100svh-4.5rem)]"
        style={{ backgroundImage: "url(/marca/banner-lp-oficial.svg)" }}
      >
        <h1 className="absolute inset-0 m-0 flex items-center justify-center">
          <img
            src="/marca/menina-mdx-inscricao.svg"
            alt={event.title}
            className="mdx-float h-auto max-h-[92%] w-auto max-w-[96%] object-contain"
          />
        </h1>
      </section>
      <Marquee className={paytone.className} />

      <section
        id="o-que-e"
        aria-labelledby="o-que-e-titulo"
        className="scroll-mt-28 bg-white bg-[length:1437px_639px] bg-repeat px-4 py-14 sm:py-20"
        style={{ backgroundImage: "url(/marca/quadriculado.svg)" }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 id="o-que-e-titulo">
              <img src="/marca/o-que-e-mdx.svg" alt="O que é o MDX STEAM?" className="w-4/5 max-w-lg sm:w-full" />
            </h2>
            <p className="mt-8 max-w-xl font-heading text-lg leading-snug font-bold text-[#330043] sm:text-xl">
              O MDX STEAM é um evento que une tecnologia, criatividade e muito aprendizado! Aqui, meninas
              exploram o mundo da ciência, da tecnologia, da engenharia, das artes e da matemática de forma
              prática, divertida e colaborativa.
            </p>
            <p className="mt-6 inline-flex rounded-full border-2 border-[#6D28D9] px-4 py-2 text-sm font-bold text-[#6D28D9] sm:text-base">
              Desenvolvido desde 2025 pelo Mermãs Digitais
            </p>
          </div>
          <NotebookScene />
        </div>
      </section>

      <section
        aria-label="Inscrição"
        className="relative overflow-hidden bg-[#330043] px-4 py-12 text-white sm:py-16"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url(/marca/estrelado.svg)" }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:items-center md:justify-between md:gap-16">
          <div className="mx-auto flex w-fit max-w-full flex-col items-center md:mx-0">
            <p className={`${erica.className} -rotate-2 text-center leading-[0.95] tracking-wide text-[clamp(1.85rem,7.4vw,2.35rem)] md:text-[clamp(1.65rem,2.3vw,2.45rem)]`}>
              <span className="block whitespace-nowrap">MERMÃ,</span>
              <span className="block whitespace-nowrap">VEM SE INSCREVER!</span>
            </p>
            <Link
              href={signupHref}
              className="mdx-glow-btn mt-8 inline-flex h-14 items-center rounded-full px-8 font-heading text-xl font-bold text-[#ffffff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              quero participar
            </Link>
          </div>
          <div className="flex w-full min-w-0 flex-col items-center gap-5 md:w-[28rem] md:shrink-0">
            <p className="rounded-full border border-white px-5 py-2 text-center font-heading text-sm font-bold md:text-xl">
              As inscrições se encerram em:
            </p>
            <Countdown startsAt={event.startsAt} endsAt={event.endsAt} tone="glass" />
          </div>
        </div>
      </section>

      <section id="quem" aria-labelledby="quem-titulo" className="scroll-mt-28 bg-[#FF4A97]">
        <h2 id="quem-titulo" className="sr-only">
          Quem pode participar?
        </h2>
        <img
          src="/marca/quem-pode-participar.jpg"
          alt="O MDX é aberto ao público. Só a competição tem regras específicas. Gamificações, sorteios, stands e atividades interativas são para todo mundo. Competir no desafio de robótica é só para meninas matriculadas no ensino fundamental ou médio, em escola pública ou particular."
          className="hidden w-full md:block"
        />
        <div className="px-3 py-8 md:hidden">
          <ParticipationCard />
        </div>
      </section>

      <section id="dentro" aria-labelledby="dentro-titulo" className="scroll-mt-28 bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 id="dentro-titulo" className="mx-auto w-fit rounded-full bg-[#6D28D9] px-5 py-2 text-center text-2xl text-white sm:text-3xl">
            O que vai rolar?
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {happenings.map((item) => (
              <li key={item.title} className="rounded-3xl p-5 text-center" style={{ background: item.background }}>
                <img src={item.icon} alt="" className="mx-auto h-14 w-14 object-contain" />
                <h3 className="mt-3 text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="onde" aria-labelledby="onde-titulo" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 id="onde-titulo" className="mx-auto w-fit rounded-full bg-[#6D28D9] px-5 py-2 text-center text-2xl text-white sm:text-3xl">
            Onde e quando?
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="rounded-3xl bg-white p-6 shadow-[0_10px_0_#F9A8D4]">
              <h3 className="text-sm font-bold tracking-widest text-[#DB2777] uppercase">Local do evento</h3>
              <p className="mt-3 text-2xl font-bold">{event.place || "O local ainda vai ser publicado."}</p>
              {event.address ? <p className="mt-2">{event.address}</p> : null}
              {locations.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {locations.map((location) => (
                    <li key={location.id} className="rounded-full bg-[#FCE7F3] px-3 py-1 text-sm font-semibold">
                      {location.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
            <article className="rounded-3xl bg-white p-6 shadow-[0_10px_0_#C4B5FD]">
              <h3 className="text-sm font-bold tracking-widest text-[#6D28D9] uppercase">Data do evento</h3>
              <p className="mt-3 text-2xl font-bold">{formatRange(event.startsAt, event.endsAt)}</p>
              <p className="mt-2 text-sm font-semibold text-[#6D28D9]">Horário de Fortaleza.</p>
            </article>
          </div>
          {mapQuery ? (
            <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-[0_10px_0_#F5D0FE]">
              <iframe
                title={`Mapa de ${mapQuery}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=pt-BR&z=16&output=embed`}
                className="h-64 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <p className="px-4 py-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                  className="font-bold text-[#6D28D9] underline underline-offset-4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no Google Maps (abre em uma nova aba)
                </a>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section id="programacao" aria-labelledby="programacao-titulo" className="scroll-mt-28 bg-white px-4 py-16">
        <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[1fr_16rem]">
          <div>
            <h2 id="programacao-titulo" className="w-fit rounded-full bg-[#6D28D9] px-5 py-2 text-2xl text-white sm:text-3xl">
              Programação
            </h2>
            <p className="mt-4 text-sm font-semibold text-[#6D28D9]">Escolha o dia. Horários de Fortaleza.</p>
            <div className="mt-6">
              <Schedule activities={activities} />
            </div>
          </div>
          <img src="/marca/boneca.png" alt="" className="mx-auto hidden w-56 lg:block" />
        </div>
      </section>

      {rules.length > 0 || announcements.length > 0 ? (
        <section aria-label="Regulamentos e comunicados" className="px-4 py-10">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
            {rules.map((rule) => (
              <details key={rule.id} className="rounded-3xl bg-white p-4 shadow-[0_8px_0_#F5D0FE]">
                <summary className="cursor-pointer font-heading text-xl">Regulamento: {rule.title}</summary>
                <p className="mt-3 whitespace-pre-wrap">{rule.rules}</p>
              </details>
            ))}
            {announcements.map((item) => (
              <details key={item.id} className="rounded-3xl bg-white p-4 shadow-[0_8px_0_#F5D0FE]">
                <summary className="cursor-pointer font-heading text-xl">{item.title}</summary>
                <p className="mt-2 text-sm font-semibold text-[#6D28D9]">
                  <time dateTime={item.publishedAt}>{formatFortalezaDay(fortalezaDay(item.publishedAt))}</time>
                </p>
                <p className="mt-2 whitespace-pre-wrap">{item.body}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ParticipationCard() {
  return (
    <div className="-mt-6 rounded-[1.75rem] bg-white p-3 text-[#3B0764] shadow-[0_10px_0_#BE185D]">
      <table className="w-full table-fixed border-separate border-spacing-y-1.5">
        <caption className="sr-only">
          Atividades abertas ao público geral e à competição de robótica.
        </caption>
        <colgroup>
          <col className="w-[42%]" />
          <col className="w-[26%]" />
          <col className="w-[32%]" />
        </colgroup>
        <thead>
          <tr>
            <th className="p-0.5 text-center">
              <span className="flex min-h-11 items-center justify-center rounded-2xl bg-[#FF4A97] px-1 py-2 font-heading text-[0.68rem] leading-tight font-bold text-white">
                ✦ ATIVIDADE ✦
              </span>
            </th>
            <th className="p-0.5 text-center">
              <span className="flex min-h-11 items-center justify-center rounded-2xl bg-[#7C3AED] px-1 py-2 font-heading text-[0.62rem] leading-tight font-bold text-white">
                PÚBLICO GERAL
              </span>
            </th>
            <th className="p-0.5 text-center">
              <span className="flex min-h-11 items-center justify-center rounded-2xl bg-[#5B21B6] px-1 py-2 font-heading text-[0.62rem] leading-tight font-bold text-white">
                COMPETIÇÃO DE ROBÓTICA
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {participation.map((row, index) => (
            <tr key={row.name} className={index % 2 === 0 ? "bg-[#FDF2F8]" : "bg-[#FAF5FF]"}>
              <th scope="row" className="rounded-l-2xl px-2 py-2 text-left">
                <span className="flex items-center gap-2 font-heading text-[0.8rem] leading-tight font-bold">
                  <ActivityIcon name={row.icon} />
                  {row.name}
                </span>
              </th>
              <td className="px-1 py-2 text-center">
                <Mark ok={row.general} />
              </td>
              <td className="rounded-r-2xl px-1 py-2 text-center">
                <Mark ok={row.girls} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 rounded-2xl bg-[#FFE14A] px-3 py-3 text-sm leading-snug">
        <strong>Para competir:</strong> ser menina e estar matriculada no Ensino Fundamental ou Médio, em escola pública
        ou particular, de qualquer cidade.
      </div>
      <p className="mt-3 text-center text-xs leading-snug font-bold">
        ✦ Todas as pessoas podem visitar o evento e participar das atividades abertas! ✦
      </p>
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xl font-bold ${ok ? "text-[#FF4A97]" : "text-[#7C3AED]"}`} aria-label={ok ? "sim" : "não"}>
      {ok ? "✓" : "✕"}
    </span>
  );
}

function ActivityIcon({ name }: { name: (typeof participation)[number]["icon"] }) {
  const paths = {
    game: "M8 14h8v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2Zm-2-1.5A1.5 1.5 0 0 1 7.5 11H9V8.5A1.5 1.5 0 0 1 10.5 7h3A1.5 1.5 0 0 1 15 8.5V11h1.5a1.5 1.5 0 0 1 1.5 1.5V14H6v-1.5ZM9 12h1.2M13.5 12H15",
    gift: "M5 10h14v9H5v-9Zm1-3h12v3H6V7Zm6-3c-1.4 1.2-2.2 2.2-2.2 3H12V4Zm0 0c1.4 1.2 2.2 2.2 2.2 3H12V4ZM12 7v12",
    stand: "M6 10h12v8H6v-8Zm1.5-3h9l1 3h-11l1-3Zm2.5 4.5h4",
    idea: "M12 6a4 4 0 0 0-2 7.5V15h4v-1.5A4 4 0 0 0 12 6Zm-1.2 11h2.4M10.5 18.5h3",
    bot: "M12 7V5M10 5h4M8 9h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Zm2 3.2h.01M14 12.2h.01M9.5 15h5",
  } as const;
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FBCFE8] text-[#7C3AED]">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Marquee({ className }: { className: string }) {
  const phrases = Array.from({ length: 8 }, () => "VEM SE INSCREVER!");
  return (
    <div className="overflow-hidden bg-[#330043] py-1 text-white sm:py-2.5">
      <p className="sr-only">Vem se inscrever!</p>
      <div className={`${className} mdx-marquee text-xs whitespace-nowrap sm:text-xl md:text-2xl`} aria-hidden="true">
        {[0, 1].map((copy) => (
          <span key={copy} className="flex">
            {phrases.map((phrase, index) => (
              <span key={index} className="px-2 sm:px-4 md:px-8">
                {phrase}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

function withLocations(
  activities: NonNullable<PublicEvent["activities"]>,
  locations: NonNullable<PublicEvent["locations"]>,
): PublicActivity[] {
  const names = new Map(locations.map((item) => [item.id, item.name]));
  return activities.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.type,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    locationName: item.locationId ? names.get(item.locationId) ?? null : null,
    responsible: item.responsible,
    grantsStamp: item.grantsStamp,
    requiresEnrollment: item.requiresEnrollment,
  }));
}

function formatRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt || !endsAt) return "Datas a definir";
  const format = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: eventTimeZone,
  });
  return `${format.format(new Date(startsAt))} até ${format.format(new Date(endsAt))}`;
}
