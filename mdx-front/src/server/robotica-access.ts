"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "mdx-robotica";
const PASSWORD = "admin123";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function token(): string {
  return digest(`mdx-robotica:${PASSWORD}`).toString("hex");
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function entrarRobotica(password: string): Promise<string | null> {
  if (!timingSafeEqual(digest(password), digest(PASSWORD))) {
    return "Senha incorreta.";
  }
  (await cookies()).set(COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/desafio-robotica",
    maxAge: 60 * 60 * 16,
  });
  return null;
}

export async function roboticaAutorizada(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  return same(value, token());
}
