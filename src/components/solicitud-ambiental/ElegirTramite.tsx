"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightCircle } from "lucide-react";
import { SelectorTramite } from "@/components/vital/SelectorTramite";
import type { TramiteOpcion } from "@/components/vital/tramite-opciones";

/** Paso 1 de «Solicitud ambiental»: elegir el trámite con el buscador del catálogo. */
export function ElegirTramite({ tramites }: { tramites: (TramiteOpcion & { descripcion: string })[] }) {
  const [clave, setClave] = useState("");
  const elegido = tramites.find((t) => t.clave === clave && t.radicable) ?? null;
  // Mismo bloque que «Convertir en trámite» de VITAL: selector con buscador agrupado por SUIT y botón al lado.
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-64">
          <span className="mb-1 block text-xs font-medium text-stone-600">Solicitud ambiental</span>
          <SelectorTramite
            tramites={tramites}
            clave={clave}
            claveSugerida={null}
            onChange={setClave}
            etiqueta="Solicitud ambiental"
            textoNoRadicable="se radica en VITAL"
            publico
          />
        </div>
        {elegido ? (
          <Link
            href={elegido.href}
            className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600"
          >
            <ArrowRightCircle className="h-4 w-4" aria-hidden />
            Iniciar solicitud
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-stone-200 px-4 py-2 text-sm font-medium text-stone-500">
            <ArrowRightCircle className="h-4 w-4" aria-hidden />
            Iniciar solicitud
          </span>
        )}
      </div>
      {elegido?.descripcion && (
        <div className="mt-4 border-t border-stone-100 pt-3" aria-live="polite">
          <p className="text-sm font-semibold text-stone-800">
            {elegido.nombre}
            {elegido.suits.length > 0 && <span className="text-xs font-normal text-stone-500"> (SUIT {elegido.suits.join(", ")})</span>}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">{elegido.descripcion}</p>
        </div>
      )}
    </div>
  );
}
