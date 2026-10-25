import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederTramite, puedeEditarTramite, puedePlanearVisitas } from "@/lib/permisos";
import { etiquetaConcepto } from "@/lib/concepto-tecnico";
import { AsignarNumeroConcepto } from "@/components/formatos/AsignarNumeroConcepto";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { estructuraDesdeJson, precargaDeVisita } from "@/lib/formatos-visita-db";
import { sanearRespuestas } from "@/lib/formato-visita";
import { DocumentoFormato } from "@/components/formatos/DocumentoFormato";
import { EstiloImpresionFormato } from "@/components/formatos/EstiloImpresionFormato";
import { BotonImprimir } from "@/components/BotonImprimir";

export default async function FormatoVisitaDiligenciadoPage({ params }: { params: Promise<{ id: string; visitaId: string }> }) {
  const { id, visitaId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const visita = await db.visitaProgramada.findUnique({
    where: { id: visitaId },
    select: {
      id: true,
      expedienteId: true,
      profesionalId: true,
      expediente: { select: { numero: true, tramiteTipoId: true } },
      visitaTecnica: {
        select: {
          inicioReal: true,
          capturadoEn: true,
          respuestas: true,
          conceptoNumero: true,
          conceptoFecha: true,
          fotos: { select: { id: true }, orderBy: { createdAt: "asc" } },
          formatoVersion: { select: { numero: true, estructura: true, formato: { select: { codigo: true, titulo: true, versionDocumento: true, fechaDocumento: true } } } },
        },
      },
    },
  });
  if (!visita || visita.expedienteId !== id) notFound();
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederTramite(permisos, visita.expediente.tramiteTipoId)) notFound();
  const vt = visita.visitaTecnica;
  if (!vt?.formatoVersion) notFound();

  const estructura = estructuraDesdeJson(vt.formatoVersion.estructura);
  const [precarga, config] = await Promise.all([precargaDeVisita(visita.id, vt.inicioReal ?? vt.capturadoEn), getConfiguracionSitio()]);
  const f = vt.formatoVersion.formato;
  const puedeAsignar = !vt.conceptoNumero && (puedePlanearVisitas(permisos) || session.userId === visita.profesionalId) && puedeEditarTramite(permisos, visita.expediente.tramiteTipoId);

  return (
    <div className="space-y-3">
      <EstiloImpresionFormato />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/expedientes/${id}/visitas/${visita.id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Hoja de visita · {visita.expediente.numero}
        </Link>
        <span className="flex flex-wrap items-start gap-2">
          {puedeAsignar && <AsignarNumeroConcepto visitaId={visita.id} />}
          <BotonImprimir variante="secundario">Descargar / imprimir</BotonImprimir>
        </span>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft print:border-0 print:p-0 print:shadow-none">
        <DocumentoFormato
          encabezado={{ codigo: f.codigo, titulo: f.titulo, versionDocumento: f.versionDocumento, fechaDocumento: f.fechaDocumento, logoUrl: config.logoUrl }}
          estructura={estructura}
          respuestas={sanearRespuestas(estructura, vt.respuestas)}
          precarga={precarga}
          numeroConcepto={vt.conceptoNumero ? etiquetaConcepto(vt.conceptoNumero, vt.conceptoFecha) : null}
          fotos={vt.fotos.map((foto, i) => ({ id: foto.id, url: `/api/visitas-fotos/${foto.id}`, pie: `Fotografía ${i + 1}` }))}
        />
      </div>
    </div>
  );
}
