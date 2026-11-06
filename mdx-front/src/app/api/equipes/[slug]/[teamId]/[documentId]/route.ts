import { NextResponse } from "next/server";
import { readSessionToken } from "@/lib/session-token";
import { panelToken } from "@/server/panel-cookie";
import { cookies } from "next/headers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; teamId: string; documentId: string }> },
) {
  const { slug, teamId, documentId } = await context.params;
  const panel = await panelToken();
  const cookie = (await cookies()).toString();
  const token = panel ? null : await readSessionToken(cookie);
  const apiToken = panel ?? token?.apiToken;
  if (typeof apiToken !== "string") {
    return NextResponse.json({ message: "Faça login para continuar." }, { status: 401 });
  }

  const api = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const response = await fetch(
    `${api}/api/events/${encodeURIComponent(slug)}/teams/${teamId}/documents/${encodeURIComponent(documentId)}`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    return NextResponse.json(
      { message: body?.message ?? "Não foi possível baixar o documento." },
      { status: response.status },
    );
  }

  const bytes = await response.arrayBuffer();
  const headers = new Headers();
  const type = response.headers.get("content-type");
  const disposition = response.headers.get("content-disposition");
  if (type) headers.set("content-type", type);
  if (disposition) headers.set("content-disposition", disposition);
  return new NextResponse(bytes, { status: 200, headers });
}
