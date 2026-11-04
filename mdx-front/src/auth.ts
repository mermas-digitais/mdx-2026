import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { SessionMembership } from "@/types/next-auth";
import "@/types/next-auth";

class LimiteDeTentativas extends CredentialsSignin {
  code = "rate_limit";
}

function apiUrl() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/entrar" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        code: { label: "Código", type: "text" },
        password: { label: "Senha", type: "password" },
        apiToken: { label: "Sessão", type: "text" },
      },
      async authorize(credentials) {
        const apiToken = String(credentials.apiToken ?? "");
        if (apiToken) {
          const adopted = await fetch(`${apiUrl()}/api/auth/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: apiToken }),
          });
          if (!adopted.ok) return null;
          const body = (await adopted.json()) as SessionBody;
          return sessionUser(body);
        }

        const email = String(credentials.email ?? "")
          .trim()
          .toLowerCase();
        const code = String(credentials.code ?? "").replace(/\D/g, "");
        const password = String(credentials.password ?? "");
        if (!email || (!code && !password)) return null;

        const response = await fetch(`${apiUrl()}/api/auth/${code ? "otp/verify" : "login"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(code ? { email, code } : { email, password }),
        });

        if (response.status === 429) {
          throw new LimiteDeTentativas();
        }
        if (!response.ok) return null;

        return sessionUser((await response.json()) as SessionBody);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.memberships = user.memberships;
        token.apiToken = user.apiToken;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      if (token.role) session.user.role = token.role;
      session.user.memberships = token.memberships ?? [];
      return session;
    },
  },
});

type SessionBody = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "USER";
    memberships: SessionMembership[];
  };
};

function sessionUser(body: SessionBody) {
  return {
    id: body.user.id,
    name: body.user.name,
    email: body.user.email,
    role: body.user.role,
    memberships: body.user.memberships ?? [],
    apiToken: body.token,
  };
}
