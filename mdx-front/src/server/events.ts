"use server";

import { readSessionToken } from "@/lib/session-token";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { bannerError } from "@/server/event-schema";
import type { ActivityType, EventStatus, TeamRole } from "@/server/event-schema";
import type { FormFieldConfig, RegistrationCategory } from "@/server/form-schema";
import {
  canAccessAdmin,
  canCreateEvent,
  canManageEvent,
  type AuthUser,
} from "@/server/permissions";

export type AdminEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  theme: string;
  place: string;
  address: string;
  startsAt: string | null;
  endsAt: string | null;
  banner: string | null;
  status: EventStatus;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  registrationCount: number;
  activityCount: number;
  publishBlockers: string[];
  canManage: boolean;
};

export type AdminEventDetail = AdminEvent & {
  locations: { id: string; name: string; notes: string | null }[];
  members: { id: string; userId: string; name: string; email: string; role: TeamRole }[];
  activities: {
    id: string;
    locationId: string | null;
    title: string;
    description: string;
    type: ActivityType;
    startsAt: string;
    endsAt: string;
    capacity: number | null;
    requiresEnrollment: boolean;
    grantsStamp: boolean;
    responsible: string;
    displayOrder: number;
  }[];
  conflicts: {
    locationId: string;
    activityIds: [string, string];
    titles: [string, string];
  }[];
  formFields: FormFieldConfig[];
};

export type EventInput = {
  title?: string;
  slug?: string;
  theme?: string;
  description?: string;
  place?: string;
  address?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  colorAccent?: string | null;
};

type Failure = {
  ok: false;
  status: number;
  message: string;
  fields?: Record<string, string>;
  blockers?: string[];
};

type Success<T> = { ok: true; data: T };

async function currentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    memberships: session.user.memberships ?? [],
  };
}

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const cookie = (await cookies()).toString();
  const token = await readSessionToken(cookie);
  if (!token?.apiToken) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token.apiToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const api =
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return fetch(`${api}${path}`, { ...init, headers, cache: "no-store" });
}

async function parse<T>(response: Response | null): Promise<Success<T> | Failure> {
  if (!response) {
    return { ok: false, status: 401, message: "Faça login para continuar." };
  }
  if (response.status === 413) {
    return { ok: false, status: 413, message: "A imagem pode ter no máximo 2 MB." };
  }
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    fields?: Record<string, string>;
    blockers?: string[];
  } | null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: typeof body?.message === "string" ? body.message : "Não foi possível concluir.",
      fields: body?.fields,
      blockers: Array.isArray(body?.blockers) ? body.blockers : undefined,
    };
  }
  return { ok: true, data: body as T };
}

function denied(): Failure {
  return { ok: false, status: 403, message: "Sem permissão." };
}

export async function listarEventos(): Promise<Success<AdminEvent[]> | Failure> {
  const user = await currentUser();
  if (!canAccessAdmin(user)) return denied();
  return parse(await authorizedFetch("/api/admin/events"));
}

export async function obterEvento(eventId: string): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}`));
}

export async function criarEvento(input: EventInput): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canCreateEvent(user)) return denied();
  return parse(await authorizedFetch("/api/admin/events", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function salvarEvento(
  eventId: string,
  input: EventInput,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }));
}

export async function duplicarEvento(eventId: string): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/duplicate`, { method: "POST" }));
}

export async function publicarEvento(eventId: string): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/publish`, { method: "POST" }));
}

export async function encerrarEvento(eventId: string): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/close`, { method: "POST" }));
}

export async function enviarBanner(
  eventId: string,
  formData: FormData,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  const file = formData.get("banner");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, status: 400, message: "Escolha uma imagem." };
  }
  const message = bannerError({ mimetype: file.type, size: file.size });
  if (message) return { ok: false, status: 400, message };
  const body = new FormData();
  body.set("banner", file);
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/banner`, {
    method: "POST",
    body,
  }));
}

export async function criarLocal(
  eventId: string,
  input: { name: string; notes?: string },
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/locations`, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function removerLocal(
  eventId: string,
  locationId: string,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/locations/${locationId}`, {
    method: "DELETE",
  }));
}

export async function convidarPessoa(
  eventId: string,
  input: { email: string; role: TeamRole },
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/members`, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function atualizarPapel(
  eventId: string,
  memberId: string,
  role: TeamRole,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  }));
}

export async function removerPessoa(
  eventId: string,
  memberId: string,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/members/${memberId}`, {
    method: "DELETE",
  }));
}

export type ActivityInput = {
  title: string;
  description?: string;
  type: ActivityType;
  locationId?: string | null;
  startsAt: string;
  endsAt: string;
  responsible: string;
  capacity?: number | null;
  requiresEnrollment?: boolean;
  grantsStamp?: boolean;
};

export async function criarAtividade(
  eventId: string,
  input: ActivityInput,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/activities`, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function atualizarAtividade(
  eventId: string,
  activityId: string,
  input: ActivityInput,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/activities/${activityId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }));
}

export async function duplicarAtividade(
  eventId: string,
  activityId: string,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/activities/${activityId}/duplicate`, {
    method: "POST",
  }));
}

export async function reordenarAtividades(
  eventId: string,
  ids: string[],
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/activities/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  }));
}

export async function criarStandsSteam(
  eventId: string,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/activities/steam`, {
    method: "POST",
  }));
}

export async function removerAtividade(
  eventId: string,
  activityId: string,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/activities/${activityId}`, {
    method: "DELETE",
  }));
}

export type FormFieldInput = {
  label: string;
  help?: string;
  type: FormFieldConfig["type"];
  required?: boolean;
  options?: string[];
  categories?: RegistrationCategory[];
};

export async function criarCampo(
  eventId: string,
  input: FormFieldInput,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/form-fields`, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function atualizarCampo(
  eventId: string,
  fieldId: string,
  input: FormFieldInput,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/form-fields/${fieldId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }));
}

export async function removerCampo(
  eventId: string,
  fieldId: string,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/form-fields/${fieldId}`, {
    method: "DELETE",
  }));
}

export async function reordenarCampos(
  eventId: string,
  ids: string[],
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/form-fields/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  }));
}

export async function criarPerguntasCompeticao(
  eventId: string,
): Promise<Success<AdminEventDetail> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/form-fields/competitor`, {
    method: "POST",
  }));
}

export type AccountProfile = {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
};

export type RoboticsMember = {
  id: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  linked: boolean;
  accountName: string | null;
  accountEmail: string | null;
  accountPhone: string | null;
  accountInstitution: string | null;
};

export type RoboticsTeam = {
  id: string;
  name: string;
  institution: string;
  advisorName: string;
  advisorEmail: string;
  advisorPhone: string;
  withdrawnAt: string | null;
  members: RoboticsMember[];
  modalities: { modalityId: string; name: string; status: "CONFIRMED" | "WAITLIST" | "CANCELLED" }[];
};

export async function meuPerfil(): Promise<Success<AccountProfile> | Failure> {
  const user = await currentUser();
  if (!user) return { ok: false, status: 401, message: "Faça login para continuar." };
  return parse(await authorizedFetch("/api/auth/me"));
}

export async function minhasEquipes(slug: string): Promise<Success<RoboticsTeam[]> | Failure> {
  const user = await currentUser();
  if (!user) return { ok: false, status: 401, message: "Entre na sua conta para se inscrever." };
  return parse(await authorizedFetch(`/api/events/${encodeURIComponent(slug)}/teams`));
}

export async function inscreverEquipe(
  slug: string,
  formData: FormData,
): Promise<Success<RoboticsTeam> | Failure> {
  const user = await currentUser();
  if (!user) return { ok: false, status: 401, message: "Entre na sua conta para se inscrever." };
  return parse(await authorizedFetch(`/api/events/${encodeURIComponent(slug)}/teams`, {
    method: "POST",
    body: formData,
  }));
}

export async function desistirEquipe(
  slug: string,
  teamId: string,
): Promise<Success<RoboticsTeam> | Failure> {
  const user = await currentUser();
  if (!user) return { ok: false, status: 401, message: "Entre na sua conta para se inscrever." };
  return parse(await authorizedFetch(`/api/events/${encodeURIComponent(slug)}/teams/${teamId}/withdraw`, {
    method: "POST",
  }));
}

export async function listarEquipes(
  eventId: string,
): Promise<Success<RoboticsTeam[]> | Failure> {
  const user = await currentUser();
  if (!canManageEvent(user, eventId)) return denied();
  return parse(await authorizedFetch(`/api/admin/events/${eventId}/robotics-teams`));
}

export async function inscrever(
  slug: string,
  input: {
    name: string;
    email: string;
    cpf: string;
    phone: string;
    institution: string;
    category: RegistrationCategory;
    answers?: Record<string, unknown>;
  },
): Promise<Success<{ id: string; passportCode: string }> | Failure> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, status: 401, message: "Entre na sua conta para se inscrever." };
  }
  return parse(await authorizedFetch(`/api/events/${encodeURIComponent(slug)}/registrations`, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}
