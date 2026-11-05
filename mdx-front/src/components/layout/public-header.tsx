import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#330043]/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Logo />
        <Link
          href="/e/mdx-2026/inscricao"
          className="mdx-glow-btn ml-auto inline-flex h-10 items-center rounded-full px-4 font-heading text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#330043] sm:h-11 sm:px-5 sm:text-base"
        >
          Inscreva-se
        </Link>
      </div>
      <div className="flex h-1.5" aria-hidden="true">
        <span className="flex-1 bg-brand-pink" />
        <span className="flex-1 bg-brand-purple-bright" />
        <span className="flex-1 bg-brand-purple" />
        <span className="flex-1 bg-brand-pink-dark" />
      </div>
    </header>
  );
}
