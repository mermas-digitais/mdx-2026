import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function EntrarPage() {
  return (
    <main
      className="flex min-h-dvh w-screen flex-col bg-[#FF4A97] bg-cover bg-center"
      style={{ backgroundImage: "url(/marca/banner-lp-oficial.svg)" }}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <div className="px-5 pt-4">
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-white drop-shadow">
            ← Voltar
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 items-end justify-center px-6">
          <img
            src="/marca/menina-mdx-inscricao.svg"
            alt=""
            className="max-h-full w-auto max-w-[78%] object-contain drop-shadow-[0_16px_24px_rgba(51,0,67,0.25)]"
          />
        </div>
        <section className="shrink-0 rounded-t-[2.25rem] bg-white px-6 pt-6 pb-6 shadow-[0_-18px_40px_rgba(51,0,67,0.16)]">
          <Suspense fallback={<p className="text-center text-sm text-[#8B7C99]">Carregando…</p>}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
