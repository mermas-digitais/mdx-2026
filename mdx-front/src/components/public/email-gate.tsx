"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { inscriptionInputClass } from "@/components/public/masked-fields";
import { CodeBoxes, GradientButton } from "@/components/public/form-chrome";

export type VerifiedEmail = {
  email: string;
  name: string;
  proof?: string;
};

function apiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export function EmailGate({
  initialEmail = "",
  onVerified,
}: {
  initialEmail?: string;
  onVerified: (verified: VerifiedEmail) => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState<VerifiedEmail | null>(null);

  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => onVerified(ready), reduced ? 700 : 2300);
    return () => window.clearTimeout(timer);
  }, [onVerified, ready]);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch(`${apiUrl()}/api/auth/otp/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json().catch(() => null)) as { message?: unknown; devCode?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(typeof body?.message === "string" ? body.message : "Não foi possível enviar o código.");
      return;
    }
    setDevCode(typeof body?.devCode === "string" ? body.devCode : null);
    setStep("code");
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch(`${apiUrl()}/api/auth/otp/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
      token?: string;
      proof?: string;
      user?: { name?: string; email?: string };
    } | null;
    if (!response.ok || !body) {
      setPending(false);
      setError(typeof body?.message === "string" ? body.message : "Código incorreto ou vencido.");
      return;
    }
    if (body.token) {
      const signed = await signIn("credentials", { apiToken: body.token, redirect: false });
      setPending(false);
      if (signed?.error) {
        setError("Não foi possível entrar com esse código.");
        return;
      }
      setReady({ email: body.user?.email ?? email, name: body.user?.name ?? "" });
      return;
    }
    setPending(false);
    setReady({ email, name: "", proof: body.proof });
  }

  if (ready) {
    return <EmailConfirmed email={ready.email} />;
  }

  if (step === "code") {
    return (
      <form className="flex flex-col gap-6" onSubmit={(event) => void confirm(event)}>
        <div className="text-center">
          <p className="text-sm font-bold tracking-widest text-[#FF4A97] uppercase">Enviamos um código no seu e-mail</p>
          <h2 className="mt-2 font-heading text-3xl leading-tight text-[#330043]">Digite o código que você recebeu</h2>
        </div>
        <CodeBoxes value={code} onChange={setCode} />
        {devCode ? (
          <p className="rounded-2xl bg-[#F6F0FF] px-4 py-3 text-center text-sm text-[#4C1D95]">
            Neste ambiente o código é <strong>{devCode}</strong>.
          </p>
        ) : (
          <p className="text-center text-sm text-[#8B7C99]">Olhe a caixa de entrada de {email}.</p>
        )}
        {error ? <p role="alert" className="text-center text-sm font-semibold text-[#BE185D]">{error}</p> : null}
        <GradientButton type="submit" disabled={pending || code.length < 6}>
          {pending ? "Enviando…" : "Enviar"}
        </GradientButton>
        <button type="button" className="text-sm font-semibold text-[#8B7C99]" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
          Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={(event) => void sendCode(event)}>
      <div className="text-center">
        <p className="text-sm font-bold tracking-widest text-[#FF4A97] uppercase">Vamos começar</p>
        <h2 className="mt-2 font-heading text-3xl leading-tight text-[#330043]">Qual é o seu e-mail?</h2>
        <p className="mt-2 text-sm text-[#8B7C99]">Enviamos um código para confirmar. Vale para participante e para orientador.</p>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-[#330043]">E-mail*:</span>
        <input
          type="email"
          required
          value={email}
          onChange={(item) => setEmail(item.target.value)}
          autoComplete="email"
          placeholder="seu@email.com"
          className={inscriptionInputClass}
        />
      </label>
      {error ? <p role="alert" className="text-center text-sm font-semibold text-[#BE185D]">{error}</p> : null}
      <GradientButton type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar"}</GradientButton>
    </form>
  );
}

function EmailConfirmed({ email }: { email: string }) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center text-center" role="status">
      <div className="email-ok-badge relative size-40">
        <span className="email-ok-ring" />
        <span className="email-ok-ring email-ok-ring-late" />
        <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
          <defs>
            <linearGradient id="email-ok-gradient" x1="18" y1="18" x2="104" y2="104" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF4A97" />
              <stop offset="1" stopColor="#FFB347" />
            </linearGradient>
          </defs>
          <circle className="email-ok-circle" cx="60" cy="60" r="46" />
          <path className="email-ok-check" d="M38 62 L54 78 L84 46" />
        </svg>
        <Sparkle className="email-ok-spark top-1 right-2 text-[#FFCD34]" />
        <Sparkle className="email-ok-spark top-8 -left-1 text-[#FF4A97] [animation-delay:1s]" />
        <Sparkle className="email-ok-spark right-0 bottom-6 text-[#B457FC] [animation-delay:1.1s]" />
      </div>
      <div className="email-ok-copy">
        <p className="mt-6 font-heading text-3xl text-[#330043]">E-mail confirmado</p>
        <p className="mt-2 text-sm text-[#8B7C99]">{email}</p>
      </div>
    </div>
  );
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-5 ${className}`} aria-hidden="true">
      <path fill="currentColor" d="M12 0l1.8 8.2L22 10l-8.2 1.8L12 20l-1.8-8.2L2 10l8.2-1.8L12 0z" />
    </svg>
  );
}
