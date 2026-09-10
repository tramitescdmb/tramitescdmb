import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { formatearFechaHoraLarga as fechaHora } from "@/lib/fecha";

export const metadata: Metadata = { title: "Verificación de radicado — CDMB" };

const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Comunicación recibida", ENVIADA: "Comunicación enviada", INTERNA: "Memorando interno" };
const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada", EN_REPARTO: "En reparto", ASIGNADA: "Asignada", EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Información adicional requerida", RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada", ANULADA: "Anulada",
};

// Página pública (sin autenticación) — habilitada por prefijo en src/middleware.ts.
// Destino del QR del rótulo de radicación: confirma que un número de radicado
// impreso en un documento físico corresponde a un registro real del SGDEA. No
// expone el asunto ni los datos del tercero — solo lo necesario para verificar.
export default async function VerificarRadicadoPage({ params }: { params: Promise<{ radicado: string }> }) {
  const { radicado } = await params;
  const num = decodeURIComponent(radicado).trim().toUpperCase();

  const c = await db.comunicacion.findUnique({
    where: { radicado: num },
    select: { radicado: true, tipo: true, estado: true, fechaRadicacion: true, folios: true, anio: true },
  });

  if (!c) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-stone-900">Radicado no encontrado</h1>
          <p className="mt-1 text-sm text-stone-600">
            No existe ningún radicado <span className="font-mono">{num}</span> en el Sistema de Gestión de
            Documentos Electrónicos de Archivo de la CDMB. Revise el número o comuníquese con la ventanilla de
            correspondencia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6">
        <div className="flex items-center gap-2 border-b border-emerald-200/70 pb-3">
          <CheckCircle2 className="h-6 w-6 flex-none text-emerald-600" aria-hidden />
          <div>
            <h1 className="text-base font-semibold text-stone-900">Radicado verificado</h1>
            <p className="text-xs text-stone-500">Corresponde a un registro real del SGDEA de la CDMB.</p>
          </div>
        </div>

        <p className="my-4 text-center font-mono text-xl font-bold tracking-tight text-cdmb-800">{c.radicado}</p>

        <dl className="divide-y divide-emerald-100 text-sm">
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Tipo</dt>
            <dd className="text-stone-900">{ETIQUETA_TIPO[c.tipo] ?? c.tipo}</dd>
          </div>
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Radicado el</dt>
            <dd className="text-stone-900">{fechaHora(c.fechaRadicacion)}</dd>
          </div>
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Estado actual</dt>
            <dd className="text-stone-900">{ETIQUETA_ESTADO[c.estado] ?? c.estado}</dd>
          </div>
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Folios</dt>
            <dd className="text-stone-900">{c.folios}</dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-emerald-200/70 pt-3 text-[11px] leading-relaxed text-stone-500">
          Consecutivo inalterable conforme al Acuerdo 060 de 2001 del Archivo General de la Nación. Esta página
          confirma la existencia y el estado del radicado; no revela el contenido, que está sujeto a las reglas
          de acceso a la información (Ley 1712 de 2014).
        </p>
      </div>
    </div>
  );
}
