import type { ReactNode } from "react";
import Link from "next/link";
import { Archive, Lock } from "lucide-react";
import { HistoricoTabs } from "@/components/HistoricoTabs";

/**
 * Sección "SINCA 1.0 · Consulta histórica". Es un espejo de solo lectura de las
 * solicitudes del sistema anterior. Ninguna pantalla de aquí crea, edita ni
 * elimina datos.
 */
export default function HistoricoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Archive className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-stone-900">SINCA 1.0 · Consulta histórica</h1>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Solicitudes registradas en el sistema anterior de la CDMB (SINCA 1.0).
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <Lock className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
        <p>
          <strong>Información histórica — solo consulta.</strong> Estos registros no se pueden crear,
          modificar ni eliminar desde esta aplicación; provienen del sistema SINCA 1.0.
        </p>
      </div>

      <HistoricoTabs />

      {children}

      <p className="text-xs text-stone-400">
        ¿Falta un trámite o hay un dato equivocado? La fuente es el sistema SINCA 1.0; la corrección debe
        hacerse allí y se reflejará en la siguiente actualización.{" "}
        <Link href="/historico" className="underline hover:text-stone-600">
          Ver estado de la última actualización
        </Link>
        .
      </p>
    </div>
  );
}
