export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-brand-purple/15 bg-white">
      <div className="flex h-1.5" aria-hidden="true">
        <span className="flex-1 bg-brand-purple" />
        <span className="flex-1 bg-brand-pink" />
        <span className="flex-1 bg-brand-purple-bright" />
        <span className="flex-1 bg-brand-pink-dark" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <img
          src="/marca/logo-mermas.svg"
          alt="Mermãs Digitais"
          width={105}
          height={38}
          className="h-10 w-auto"
        />
      </div>
    </footer>
  );
}
