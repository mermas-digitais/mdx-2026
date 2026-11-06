import { cookies } from "next/headers";

export const PANEL_COOKIE = "mdx-painel";

export async function panelToken(): Promise<string | null> {
  return (await cookies()).get(PANEL_COOKIE)?.value ?? null;
}
