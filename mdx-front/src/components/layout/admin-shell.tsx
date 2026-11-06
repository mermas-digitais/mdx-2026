"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, House, Palette, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LeavePanel } from "@/components/admin/leave-panel";
import { Bandeirola } from "@/components/brand/bandeirola";
import { cn } from "cn";

const links = [
  { href: "/admin", label: "Visão geral", icon: House },
  { href: "/admin/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/design-system", label: "Design system", icon: Palette },
  { href: "/", label: "Site público", icon: House },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(true);

  return (
    <div className="flex min-h-full flex-1 bg-brand-lilac">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          aberto ? "w-64" : "w-20",
        )}
      >
        <div className={cn("flex items-center gap-2 px-3 py-4", !aberto && "justify-center")}>
          <span aria-hidden="true">
            <Bandeirola letra="M" cor="rosa" tamanho="sm" />
          </span>
          {aberto ? (
            <p className="font-heading text-base leading-tight font-semibold">
              Painel
              <span className="block text-sm font-medium text-brand-lilac">
                Mermãs
              </span>
            </p>
          ) : null}
        </div>
        <nav id="admin-nav" aria-label="Painel" className="flex flex-1 flex-col gap-1 px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const ativo =
              link.href === "/" || link.href === "/admin"
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={ativo ? "page" : undefined}
                title={link.label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-3 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                  ativo
                    ? "bg-sidebar-accent text-white"
                    : "hover:bg-sidebar-accent/70",
                  !aberto && "justify-center px-0",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={cn(!aberto && "sr-only")}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 p-2">
          <LeavePanel />
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="admin-nav"
            onClick={() => setAberto((valor) => !valor)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            {aberto ? (
              <PanelLeftClose aria-hidden="true" className="size-4" />
            ) : (
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            )}
            <span className={cn(!aberto && "sr-only")}>
              {aberto ? "Recolher menu" : "Abrir menu"}
            </span>
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
