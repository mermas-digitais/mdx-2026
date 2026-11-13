import Link from "next/link";
import { Erica_One, Paytone_One } from "next/font/google";
import { Countdown } from "@/components/public/countdown";
import type { PublicEvent } from "@/lib/api";

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

const eventCards = [
  { src: "/marca/competicoes.svg", alt: "Competições", delay: "0s" },
  { src: "/marca/ia.svg", alt: "IA", delay: "0.5s" },
  { src: "/marca/robotica.svg", alt: "Robótica", delay: "1s" },
  { src: "/marca/ciencia.svg", alt: "Ciência", delay: "1.5s" },
  { src: "/marca/jogos.svg", alt: "Jogos", delay: "2s" },
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
  const teamHref = `${signupHref}?acesso=equipe`;

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
          <span className="sr-only">{event.title}</span>
          <img
            src="/marca/menina-mdx-inscricao.svg"
            alt=""
            aria-hidden="true"
            className="mdx-float h-auto max-h-[92%] w-auto max-w-[96%] object-contain"
          />
        </h1>
      </section>
      <Marquee className={paytone.className} />

      <section
        id="o-que-e"
        aria-labelledby="o-que-e-titulo"
        className="relative scroll-mt-28 overflow-hidden bg-white px-4 py-14 sm:py-20"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[length:1437px_639px] bg-repeat opacity-20"
          style={{ backgroundImage: "url(/marca/quadriculado.svg)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
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
            <Link
              href={teamHref}
              className="mt-4 inline-flex h-12 items-center rounded-full border-2 border-white px-6 font-heading text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              acessar minha equipe
            </Link>
          </div>
          <div className="flex w-full min-w-0 flex-col items-center gap-5 md:w-[28rem] md:shrink-0">
            <p className="rounded-full border border-white px-5 py-2 text-center font-heading text-sm font-bold md:text-xl">
              As inscrições se encerram em:
            </p>
            <Countdown deadline="2026-11-21T03:00:00.000Z" tone="glass" />
          </div>
        </div>
      </section>

      <section id="regulamento" aria-labelledby="regulamento-titulo" className="relative scroll-mt-28 overflow-hidden bg-white px-4 py-12 md:px-8 md:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[length:1437px_639px] bg-repeat opacity-20"
          style={{ backgroundImage: "url(/marca/quadriculado.svg)" }}
        />
        <div className="relative mx-auto max-w-6xl">
          <h2 id="regulamento-titulo" className="w-4/5 max-w-sm md:w-[48%] md:max-w-none">
            <img src="/marca/confira-regulamento.svg" alt="Confira o regulamento da competição" className="h-auto w-full" />
          </h2>
          <div className="mt-6 flex flex-col items-center gap-8 md:mt-2 md:flex-row md:items-center md:gap-8">
            <img
              src="/marca/desafio-robotica.svg"
              alt="Desafio de robótica"
              className="h-auto w-full md:w-[54%]"
            />
            <div className="relative w-full overflow-hidden rounded-[1.75rem] border border-[#E7E5E4] bg-white shadow-[0_10px_30px_rgb(51_0_67_/_0.06)] md:w-[46%]">
              <img
                src="/marca/regulamento-robotica-preview.png"
                alt="Capa do regulamento oficial de robótica do MDX STEAM"
                className="block h-auto w-full"
              />
              <a
                href="/marca/regulamento-robotica.pdf"
                download="Regulamento Oficial Robótica MDX Steam.pdf"
                className={`${paytone.className} absolute bottom-6 left-1/2 z-10 inline-flex -translate-x-1/2 items-center rounded-full bg-[#330043] px-8 py-3 text-sm tracking-wide text-white shadow-[0_8px_0_rgb(51_0_67_/_0.18)] transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#330043] md:bottom-8 md:px-10 md:py-3.5 md:text-base`}
              >
                BAIXAR PDF
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="quem" aria-labelledby="quem-titulo" className="scroll-mt-28 bg-[#FF4A97]">
        <div className="relative">
          <img
            src="/marca/carro-e-tabela.svg"
            alt="Gamificações, sorteios, conhecer os stands e participar das atividades interativas valem para o público geral e para a competição de robótica. Competir no desafio de robótica vale só para a competição."
            className="block w-full"
          />
          <h2 id="quem-titulo" className="absolute top-[3%] left-[3%] w-[42%] xl:top-[4%] xl:w-[30%]">
            <img src="/marca/quem-pode-participar.svg" alt="Quem pode participar?" className="h-auto w-full" />
          </h2>
          <p className="absolute top-[3%] left-[48%] flex h-[27%] w-[49%] items-center pr-[3%] text-left text-[clamp(0.68rem,2.7vw,0.8rem)] leading-snug font-semibold text-white xl:hidden">
            Atenção: para competir é preciso ser menina e estar matriculada em alguma escola, o professor orientador da equipe não precisa ser mulher.
          </p>
          <div className="absolute top-[8%] right-[4%] hidden h-[10.5%] w-[52%] items-center gap-4 rounded-3xl bg-white px-5 text-[#330043] shadow-[0_8px_0_#BE185D] xl:flex">
            <span className="block h-24 w-32 shrink-0 overflow-hidden" aria-hidden="true">
              <img src="/marca/logo-mermas.svg" alt="" className="h-24 w-auto max-w-none" />
            </span>
            <p className="text-lg leading-snug font-bold xl:text-xl">
              Atenção: para competir é preciso ser menina e estar matriculada em alguma escola, o professor orientador da equipe não precisa ser mulher.
            </p>
          </div>
        </div>
      </section>

      <section
        id="dentro"
        aria-labelledby="dentro-titulo"
        className="scroll-mt-28 bg-[#9B6DFF] bg-[url('/marca/ondas.svg')] bg-[length:1440px_597px] bg-repeat px-4 py-10 md:px-10 md:py-14"
      >
        <h2 id="dentro-titulo" className="w-4/5 max-w-xs md:w-80">
          <img src="/marca/o-que-vai-acontecer.svg" alt="O que vai acontecer?" className="h-auto w-full" />
        </h2>
        <ul className="mx-auto mt-10 flex w-full max-w-6xl flex-col items-center gap-8 md:mt-10 md:flex-row md:items-end md:justify-between md:gap-16">
          {eventCards.map((card) => (
            <li key={card.src} className="mdx-float w-[min(9rem,42%)] md:w-auto md:min-w-0 md:flex-1" style={{ animationDelay: card.delay }}>
              <img
                src={card.src}
                alt={card.alt}
                className="mx-auto h-auto w-full transition-transform duration-300 hover:scale-[1.12]"
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Quero me inscrever" className="relative overflow-hidden bg-[#330043]">
        <div className="relative h-60 overflow-hidden md:h-auto">
          <img
            src="/marca/raios.svg"
            alt=""
            className="absolute top-1/2 left-1/2 w-[210%] max-w-none -translate-x-1/2 -translate-y-1/2 md:static md:w-full md:translate-none"
          />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
          <Link
            href={signupHref}
            className={`${paytone.className} mdx-inscrever inline-flex items-center rounded-full px-8 py-3 text-lg tracking-wide transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:px-12 md:py-4 md:text-2xl`}
          >
            QUERO ME INSCREVER
          </Link>
          <Link
            href={teamHref}
            className="font-heading text-base font-bold text-white underline decoration-white/70 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            acessar minha equipe
          </Link>
        </div>
      </section>

      <section id="onde" aria-labelledby="onde-titulo" className="scroll-mt-28 bg-[#FFCD34] px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 md:max-w-7xl md:flex-row md:items-end md:gap-4">
          <div className="flex w-full flex-col items-center gap-2 md:w-[47.7%] md:items-start md:gap-1">
            <h2 id="onde-titulo" className="w-[88%] max-w-sm -rotate-3 md:w-[91%] md:max-w-none md:rotate-0">
              <img src="/marca/onde-e-quando.svg" alt="Onde e quando vai acontecer?" className="h-auto w-full" />
            </h2>
            <img
              src="/marca/calendario.svg"
              alt="Dia 24/11 e dia 25/11, das 9h às 18h, com intervalo para almoço das 12h às 14h. Competição de robótica e muito mais."
              className="h-auto w-full -mt-10 rotate-2 md:-mt-16 md:rotate-0"
            />
          </div>
          <img
            src="/marca/endereco.svg"
            alt="IFMA Imperatriz. Avenida Newton Bello, S/N, Vila Maria, Imperatriz, MA, CEP 65906-335. Campus Imperatriz."
            className="h-auto w-full -rotate-2 md:w-[52.3%] md:rotate-0"
          />
        </div>
      </section>

      <section aria-label="Inscrição" className="relative overflow-hidden bg-[#330043] px-4 py-12 text-white sm:py-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url(/marca/estrelado.svg)" }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center">
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
          <Link
            href={teamHref}
            className="mt-4 inline-flex h-12 items-center rounded-full border-2 border-white px-6 font-heading text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            acessar minha equipe
          </Link>
        </div>
      </section>
    </main>
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
