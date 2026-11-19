"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightCircle } from "lucide-react";
import { SelectorTramite } from "@/components/vital/SelectorTramite";
import type { TramiteOpcion } from "@/components/vital/tramite-opciones";

/** Paso 1 de «Solicitud ambiental»: elegir el trámite con el buscador del catálogo. */
export function ElegirTramite({ tramites }: { tramites: TramiteOpcion[] }) {
  const [clave, setClave] = useState("");
  const elegido = tramites.find((t) => t.clave === clave && t.radicable) ?? null;
  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <span className="block text-sm font-medium text-stone-700">¿Qué trámite desea solicitar?</span>
      <SelectorTramite
        tramites={tramites}
        clave={clave}
        claveSugerida={null}
        onChange={setClave}
        etiqueta="Trámite ambiental que desea solicitar"
        textoNoRadicable="por ahora se radica en VITAL"
      />
      <p className="text-xs text-stone-500">Escriba parte del nombre, el código o el número SUIT para buscarlo.</p>
      <div className="flex justify-end">
        {elegido ? (
          <Link
            href={elegido.href}
            className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600"
          >
            <ArrowRightCircle className="h-4 w-4" aria-hidden />
            Continuar
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-stone-200 px-4 py-2 text-sm font-medium text-stone-500">
            <ArrowRightCircle className="h-4 w-4" aria-hidden />
            Continuar
          </span>
        )}
      </div>
    </div>
  );
}
