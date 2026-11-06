"use server";

import { cookies } from "next/headers";
import { PANEL_COOKIE } from "@/server/panel-cookie";

function apiUrl() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function enterPanel(password: string): Promise<string | null> {
  const response = await fetch(`${apiUrl()}/api/auth/panel-login`, {
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
  (await cookies()).set(PANEL_COOKIE, body.token, cookieOptions(60 * 60 * 12));
  return null;
}

export async function leavePanel(): Promise<void> {
  (await cookies()).set(PANEL_COOKIE, "", cookieOptions(0));
}
