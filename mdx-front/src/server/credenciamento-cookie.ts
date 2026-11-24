import { cookies } from "next/headers";

export const CREDENCIAMENTO_COOKIE = "mdx-credenciamento";

export async function credenciamentoToken(): Promise<string | null> {
  return (await cookies()).get(CREDENCIAMENTO_COOKIE)?.value ?? null;
}
