import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle, FileSignature } from "lucide-react";
import { db } from "@/lib/db";
import { formatearFechaHoraLarga as fechaHora, formatearFecha } from "@/lib/fecha";
import { ETIQUETA_ETAPA, ETIQUETA_MODALIDAD } from "@/lib/contratacion";

export const metadata: Metadata = { title: "Verificación de radicado — CDMB" };

const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Comunicación recibida", ENVIADA: "Comunicación enviada", INTERNA: "Memorando interno" };
const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada", EN_REPARTO: "En reparto", ASIGNADA: "Asignada", EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Información adicional requerida", RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada", ANULADA: "Anulada",
};

export default async function VerificarRadicadoPage({ params }: { params: Promise<{ radicado: string }> }) {
  const { radicado } = await params;
  const num = decodeURIComponent(radicado).trim().toUpperCase();

  if (num.startsWith("CDMB-CTO-")) {
    return <VerificarExpedienteContractual numero={num} />;
  }

  if (!num.startsWith("CDMB-")) {
    return <VerificarExpedienteTramite numero={num} />;
  }

  const c = await db.comunicacion.findUnique({
    where: { radicado: num },
    select: { id: true, radicado: true, tipo: true, estado: true, fechaRadicacion: true, folios: true, anio: true },
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

        <Link
          href={`/correspondencia/${c.id}/ficha-firma`}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
        >
          <FileSignature className="h-3.5 w-3.5" aria-hidden />
          Ver ficha técnica completa de firmas (requiere inicio de sesión)
        </Link>
      </div>
    </div>
  );
}

async function VerificarExpedienteContractual({ numero }: { numero: string }) {
  const e = await db.expedienteContractual.findUnique({
    where: { numero },
    select: { id: true, numero: true, modalidadSeleccion: true, etapaActual: true, cerrado: true, createdAt: true },
  });

  if (!e) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-stone-900">Expediente no encontrado</h1>
          <p className="mt-1 text-sm text-stone-600">
            No existe ningún expediente contractual <span className="font-mono">{numero}</span> en Trámites CDMB.
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
            <h1 className="text-base font-semibold text-stone-900">Expediente contractual verificado</h1>
            <p className="text-xs text-stone-500">Corresponde a un registro real del módulo de Contratación de la CDMB.</p>
          </div>
        </div>

        <p className="my-4 text-center font-mono text-xl font-bold tracking-tight text-cdmb-800">{e.numero}</p>

        <dl className="divide-y divide-emerald-100 text-sm">
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Modalidad</dt>
            <dd className="text-stone-900">{ETIQUETA_MODALIDAD[e.modalidadSeleccion]}</dd>
          </div>
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Abierto el</dt>
            <dd className="text-stone-900">{formatearFecha(e.createdAt)}</dd>
          </div>
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Estado actual</dt>
            <dd className="text-stone-900">{e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual]}</dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-emerald-200/70 pt-3 text-[11px] leading-relaxed text-stone-500">
          Esta página confirma la existencia y el estado del expediente contractual; no revela el objeto del
          contrato ni datos del contratista, sujetos a las reglas de acceso a la información (Ley 1712 de 2014).
        </p>

        <Link
          href={`/contratacion/expedientes/${e.id}/ficha-firma`}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
        >
          <FileSignature className="h-3.5 w-3.5" aria-hidden />
          Ver ficha técnica completa de firmas (requiere inicio de sesión)
        </Link>
      </div>
    </div>
  );
}

async function VerificarExpedienteTramite({ numero }: { numero: string }) {
  const e = await db.expediente.findUnique({
    where: { numero },
    select: { id: true, numero: true, estado: true, fechaRadicacion: true, tramiteTipo: { select: { nombre: true } } },
  });

  if (!e) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-stone-900">Expediente no encontrado</h1>
          <p className="mt-1 text-sm text-stone-600">
            No existe ningún expediente <span className="font-mono">{numero}</span> en Trámites ambientales de la CDMB.
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
            <h1 className="text-base font-semibold text-stone-900">Expediente verificado</h1>
            <p className="text-xs text-stone-500">Corresponde a un registro real de Trámites ambientales de la CDMB.</p>
          </div>
        </div>

        <p className="my-4 text-center font-mono text-xl font-bold tracking-tight text-cdmb-800">{e.numero}</p>

        <dl className="divide-y divide-emerald-100 text-sm">
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Trámite</dt>
            <dd className="text-stone-900">{e.tramiteTipo.nombre}</dd>
          </div>
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Radicado el</dt>
            <dd className="text-stone-900">{formatearFecha(e.fechaRadicacion)}</dd>
          </div>
          <div className="flex gap-2 py-1.5">
            <dt className="w-40 flex-none font-medium text-stone-500">Estado actual</dt>
            <dd className="text-stone-900">{e.estado.replaceAll("_", " ")}</dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-emerald-200/70 pt-3 text-[11px] leading-relaxed text-stone-500">
          Esta página confirma la existencia y el estado del expediente; no revela los datos del solicitante ni
          del predio, sujetos a las reglas de acceso a la información (Ley 1712 de 2014).
        </p>

        <Link
          href={`/expedientes/${e.id}/ficha-firma`}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
        >
          <FileSignature className="h-3.5 w-3.5" aria-hidden />
          Ver ficha técnica completa de firmas (requiere inicio de sesión)
        </Link>
      </div>
    </div>
  );
}
