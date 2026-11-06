import { auth } from "@/auth";
import { decideRouteAccess, type AuthUser } from "@/server/permissions";
import { NextResponse } from "next/server";

const forbiddenHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Sem permissão · Mermãs Digitais</title>
</head>
<body style="margin:0;background:#F5F0FF;color:#1E1033;font-family:Atkinson Hyperlegible,sans-serif">
  <main style="max-width:32rem;margin:4rem auto;padding:1.5rem">
    <h1 style="font-family:Poppins,sans-serif;color:#4C1D95">Sem permissão</h1>
    <p>Sua conta não acessa o painel.</p>
    <p><a href="/" style="color:#BE185D">Voltar ao início</a></p>
  </main>
</body>
</html>`;

export const proxy = auth((request) => {
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  const sessionUser = request.auth?.user;
  const user: AuthUser | null =
    sessionUser?.id && sessionUser.role
      ? {
          id: sessionUser.id,
          role: sessionUser.role,
          memberships: sessionUser.memberships ?? [],
        }
      : null;
  const decision = decideRouteAccess(user, request.nextUrl.pathname);

  if (decision.type === "login") {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (decision.type === "forbid") {
    return new NextResponse(forbiddenHtml, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin", "/admin/:path*", "/conta", "/conta/:path*"],
};
