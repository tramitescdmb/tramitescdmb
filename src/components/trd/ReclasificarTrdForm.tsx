"use client";

import { FolderTree, Loader2 } from "lucide-react";
import { BuscadorSubserieTRD } from "@/components/BuscadorSubserieTRD";
import { Field } from "@/components/Field";
import { useCatalogoTrd } from "@/components/trd/CatalogoTrd";

export function ReclasificarTrdForm({ action, ayudaMotivo }: { action: string; ayudaMotivo?: string }) {
  const { series, cargando, error } = useCatalogoTrd();
  if (cargando) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-stone-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Cargando la TRD…
      </p>
    );
  }
  if (error) return <p className="text-xs text-red-700">{error}</p>;
  return (
    <form action={action} method="post" className="space-y-3">
      <BuscadorSubserieTRD series={series} nameSubserie="subserieId" requerido />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <Field label="Motivo" required help={ayudaMotivo}>
            <input name="motivo" required className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
          </Field>
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
          <FolderTree className="h-3.5 w-3.5" aria-hidden />
          Reclasificar
        </button>
      </div>
    </form>
  );
}
