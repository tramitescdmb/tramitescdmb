"use client";

import { useMenuModulo } from "@/components/MenuModulo";
import { IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react";
import { SidebarNav } from "@/components/SidebarNav";
import { EncabezadoMenu } from "@/components/EncabezadoMenu";
import { SelectorColorMenu } from "@/components/SelectorColorMenu";

export function Sidebar({
  logoUrl,
  esAdmin,
  mostrarTramites,
  mostrarVital,
  mostrarSinca,
  mostrarCorrespondencia,
  mostrarContratacion,
  mostrarMemorandos = false,
  mostrarNegociosVerdes = false,
}: {
  logoUrl: string | null;
  esAdmin: boolean;
  mostrarTramites: boolean;
  mostrarVital: boolean;
  mostrarSinca: boolean;
  mostrarCorrespondencia: boolean;
  mostrarContratacion: boolean;
  mostrarMemorandos?: boolean;
  mostrarNegociosVerdes?: boolean;
}) {
  const { expandido, setExpandido } = useMenuModulo();
  const colapsado = !expandido;

  return (
    <aside
      className={`sticky top-0 hidden h-[calc(100vh-2rem)] max-h-screen flex-none flex-col bg-lateral text-white transition-[width] duration-200 lg:flex ${
        colapsado ? "w-16" : "w-[17.5rem]"
      }`}
    >
      <EncabezadoMenu logoUrl={logoUrl} colapsado={colapsado} />

      <SidebarNav
        esAdmin={esAdmin}
        mostrarTramites={mostrarTramites}
        mostrarVital={mostrarVital}
        mostrarSinca={mostrarSinca}
        mostrarCorrespondencia={mostrarCorrespondencia}
        mostrarContratacion={mostrarContratacion}
        mostrarMemorandos={mostrarMemorandos}
        mostrarNegociosVerdes={mostrarNegociosVerdes}
        colapsado={colapsado}
      />

      <div className={`flex flex-none items-center border-t border-white/10 bg-lateral-oscuro ${colapsado ? "flex-col gap-1 py-2" : "gap-1 px-2 py-2"}`}>
        <button
          type="button"
          onClick={() => setExpandido(colapsado)}
          aria-label={colapsado ? "Expandir menú" : "Contraer menú"}
          title={colapsado ? "Expandir menú" : undefined}
          className={`flex items-center gap-2 rounded-md text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lateral-acento ${
            colapsado ? "h-9 w-9 justify-center" : "h-8 flex-1 px-3"
          }`}
        >
          {colapsado ? <IconChevronsRight className="h-5 w-5" stroke={1.75} aria-hidden /> : <IconChevronsLeft className="h-5 w-5" stroke={1.75} aria-hidden />}
          {!colapsado && "Contraer menú"}
        </button>
        <SelectorColorMenu colapsado={colapsado} abreHacia={colapsado ? "derecha" : "arriba"} />
      </div>
    </aside>
  );
}
