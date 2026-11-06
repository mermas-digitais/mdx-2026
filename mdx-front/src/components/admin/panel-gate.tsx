"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enterPanel } from "@/server/panel-session";

export function PanelGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const message = await enterPanel(password);
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    setPassword("");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-lilac px-4">
      <form onSubmit={(event) => void submit(event)} className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 shadow-md">
        <div>
          <p className="text-sm font-semibold text-brand-purple">MDX</p>
          <h1 className="font-heading text-3xl">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Digite a senha para acompanhar as inscrições.</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(item) => setPassword(item.target.value)}
            autoComplete="current-password"
            required
            className="h-12 rounded-2xl border border-border bg-white px-4 text-base outline-none focus:border-brand-purple"
          />
        </label>
        {error ? <p role="alert" className="text-sm font-semibold text-brand-pink-dark">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || password.length === 0}
          className="h-12 rounded-full bg-brand-pink font-bold text-white disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
