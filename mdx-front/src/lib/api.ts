import type { ActivityType } from "@/server/event-schema";
import type { FormFieldConfig } from "@/server/form-schema";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type HealthReport =
  | { ok: true; database: string }
  | { ok: false };

type HealthResponse = {
  status?: string;
  info?: {
    database?: {
      status?: string;
    };
  };
};

export function getApiUrl() {
  return API_URL;
}

export type PublicActivity = {
  id: string;
  locationId: string | null;
  title: string;
  description: string;
  type: ActivityType;
  startsAt: string;
  endsAt: string;
  responsible: string;
  grantsStamp: boolean;
  requiresEnrollment: boolean;
};

export type PublicEvent = {
  slug: string;
  title: string;
  description: string;
  theme: string;
  place: string;
  address: string;
  startsAt: string | null;
  endsAt: string | null;
  banner: string | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  registrationsOpen: boolean;
  preview: boolean;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  fields?: FormFieldConfig[];
  locations?: { id: string; name: string; notes: string | null }[];
  activities?: PublicActivity[];
  announcements?: { id: string; title: string; body: string; publishedAt: string }[];
  rules?: { id: string; title: string; rules: string }[];
  modalities?: {
    id: string;
    name: string;
    slotLimit: number;
    confirmed: number;
    waitlist: number;
  }[];
};

export async function getPublicEvent(slug: string): Promise<PublicEvent | null | undefined> {
  try {
    const response = await fetch(`${process.env.API_URL ?? API_URL}/api/events/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    return (await response.json()) as PublicEvent;
  } catch {
    return undefined;
  }
}

export async function getHealth(): Promise<HealthReport> {
  try {
    const response = await fetch(`${process.env.API_URL ?? API_URL}/api/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false };
    }

    const body = (await response.json()) as HealthResponse;
    const database = body.info?.database?.status;

    if (body.status !== "ok" || !database) {
      return { ok: false };
    }

    return { ok: true, database };
  } catch {
    return { ok: false };
  }
}
