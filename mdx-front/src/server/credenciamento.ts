"use server";

import { cookies } from "next/headers";
import { CREDENCIAMENTO_COOKIE, credenciamentoToken } from "@/server/credenciamento-cookie";
import type { InscriptionBoard } from "@/server/events";

type Failure = {
  ok: false;
  status: number;
  message: string;
};

type Success<T> = { ok: true; data: T };

function apiUrl() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/credenciamento",
    maxAge,
  };
}

export async function entrarCredenciamento(password: string): Promise<string | null> {
  const response = await fetch(`${apiUrl()}/api/auth/credenciamento-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  if (response.status === 429) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  const body = (await response.json().catch(() => null)) as { token?: string; message?: unknown } | null;
  if (!response.ok || !body?.token) {
    return typeof body?.message === "string" ? body.message : "Senha incorreta.";
  }
  (await cookies()).set(CREDENCIAMENTO_COOKIE, body.token, cookieOptions(60 * 60 * 12));
  return null;
}

export async function sairCredenciamento(): Promise<void> {
  (await cookies()).set(CREDENCIAMENTO_COOKIE, "", cookieOptions(0));
}

export async function listarCredenciamento(
  slug: string,
): Promise<Success<InscriptionBoard> | Failure> {
  return parse(await credenciamentoFetch(`/api/admin/events/${encodeURIComponent(slug)}/inscriptions`));
}

export async function confirmarPresencaParticipante(
  slug: string,
  registrationId: string,
  present: boolean,
): Promise<Success<InscriptionBoard> | Failure> {
  return parse(await credenciamentoFetch(
    `/api/admin/events/${encodeURIComponent(slug)}/inscriptions/${registrationId}/check-in`,
    { method: "PATCH", body: JSON.stringify({ present }) },
  ));
}

export async function confirmarPresencaOrientador(
  slug: string,
  teamId: string,
  present: boolean,
): Promise<Success<InscriptionBoard> | Failure> {
  return parse(await credenciamentoFetch(
    `/api/admin/events/${encodeURIComponent(slug)}/robotics-teams/${teamId}/advisor/check-in`,
    { method: "PATCH", body: JSON.stringify({ present }) },
  ));
}

export async function confirmarPresencaAluna(
  slug: string,
  teamId: string,
  memberId: string,
  present: boolean,
): Promise<Success<InscriptionBoard> | Failure> {
  return parse(await credenciamentoFetch(
    `/api/admin/events/${encodeURIComponent(slug)}/robotics-teams/${teamId}/members/${memberId}/check-in`,
    { method: "PATCH", body: JSON.stringify({ present }) },
  ));
}

async function credenciamentoFetch(path: string, init: RequestInit = {}) {
  const token = await credenciamentoToken();
  if (!token) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

async function parse<T>(response: Response | null): Promise<Success<T> | Failure> {
  if (!response) {
    return { ok: false, status: 401, message: "Digite a senha para continuar." };
  }
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: typeof body?.message === "string" ? body.message : "Não foi possível concluir.",
    };
  }
  return { ok: true, data: body as T };
}
