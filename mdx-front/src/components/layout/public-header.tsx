import { Logo } from "@/components/layout/logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#330043]/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-2">
        <Logo />
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
