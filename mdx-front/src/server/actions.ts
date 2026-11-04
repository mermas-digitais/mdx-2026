"use server";

import { readSessionToken } from "@/lib/session-token";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  canEditOwnRegistration,
  canManageEvent,
  type AuthUser,
} from "@/server/permissions";

async function currentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    memberships: session.user.memberships ?? [],
  };
}

async function apiToken() {
  const cookie = (await cookies()).toString();
  const token = await readSessionToken(cookie);
  return token?.apiToken ?? null;
}

async function callApi(path: string, method: string) {
  const token = await apiToken();
  if (!token) return 401;
  const api =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001";
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return response.status;
}

export async function atualizarInscricao(ownerId: string) {
  const user = await currentUser();
  if (!canEditOwnRegistration(user, ownerId)) {
    return { ok: false as const, status: 403 as const };
  }
  const status = await callApi(`/api/conta/registrations/${ownerId}`, "PATCH");
  if (status === 403) return { ok: false as const, status: 403 as const };
  if (status !== 200) return { ok: false as const, status };
  return { ok: true as const };
}

export async function editarEvento(eventId: string) {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) {
    return { ok: false as const, status: 403 as const };
  }
  const status = await callApi(`/api/admin/events/${eventId}`, "PATCH");
  if (status === 403) return { ok: false as const, status: 403 as const };
  if (status !== 200) return { ok: false as const, status };
  return { ok: true as const };
}
