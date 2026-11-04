import { getToken } from "next-auth/jwt";

export function readSessionToken(cookie: string) {
  return getToken({
    req: { headers: { cookie } },
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.AUTH_URL?.startsWith("https://") ?? false,
  });
}
