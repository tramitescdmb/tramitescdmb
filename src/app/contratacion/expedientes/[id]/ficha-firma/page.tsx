import { notFound, redirect } from "next/navigation";
import { FileSignature, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerExpedienteContractual } from "@/lib/permisos";
import { etiquetaFormatoFirma } from "@/lib/firma-proveedor";
import { formatearFechaHoraLarga } from "@/lib/fecha";
import { BotonImprimir } from "@/components/BotonImprimir";

/**
 * Ficha técnica COMPLETA de las firmas de TODOS los documentos de este expediente
 * contractual — misma lógica que la ficha de correspondencia (ver ese archivo para el
 * porqué de exigir sesión en vez de publicarlo junto al QR público de /verificar).
 */
export default async function FichaFirmaExpedienteContractualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/contratacion/expedientes/${id}/ficha-firma`);
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({
    where: { id },
    select: {
      numero: true,
      objeto: true,
      contratistaId: true,
      documentos: {
        where: { firmas: { some: {} } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          nombre: true,
          firmas: {
            orderBy: { fechaHora: "asc" },
            include: { usuario: { select: { nombre: true, denominacionEmpleo: true } } },
          },
        },
      },
    },
  });
  if (!expediente) notFound();
  if (!puedeVerExpedienteContractual(permisos, { id, contratistaId: expediente.contratistaId })) redirect("/contratacion");

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <FileSignature className="h-5 w-5 text-cdmb-600" aria-hidden />
          Ficha técnica de firmas
        </h1>
        <BotonImprimir variante="secundario">Descargar / imprimir</BotonImprimir>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="font-mono text-sm text-stone-500">{expediente.numero}</p>
        <p className="mt-0.5 text-base font-medium text-stone-900">{expediente.objeto}</p>

        {expediente.documentos.length === 0 ? (
          <p className="mt-4 text-sm text-stone-400">Este expediente todavía no tiene ningún documento firmado.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {expediente.documentos.map((doc) => (
              <div key={doc.id}>
                <p className="mb-1.5 text-sm font-semibold text-stone-800">{doc.nombre}</p>
                <ul className="space-y-3">
                  {doc.firmas.map((f) => (
                    <li key={f.id} className="rounded-lg border border-stone-100 bg-stone-50/60 p-3 text-sm">
                      <p className="flex items-center gap-1.5 font-medium text-stone-900">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                        {f.usuario.nombre}
                        {f.usuario.denominacionEmpleo && <span className="font-normal text-stone-500"> — {f.usuario.denominacionEmpleo}</span>}
                      </p>
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                        <Dato k="Fecha y hora" v={formatearFechaHoraLarga(f.fechaHora)} />
                        <Dato k="Algoritmo / formato" v={etiquetaFormatoFirma(f.formato)} />
                        <Dato k="Proveedor" v={f.proveedor} />
                        <Dato k="Hash SHA-256 del contenido" v={f.hashContenido} mono />
                        <Dato k="Dirección IP" v={f.ip ?? "no disponible"} mono />
                        <Dato k="Agente de usuario" v={f.userAgent ?? "no disponible"} mono />
                        <Dato k="Identificador de la firma" v={f.id} mono />
                        {f.selloTiempoEn && <Dato k="Sello de tiempo" v={`${formatearFechaHoraLarga(f.selloTiempoEn)} — ${f.selloTiempoFuente ?? ""}`} />}
                        {f.selloTiempoToken && <Dato k="Token RFC-3161" v={f.selloTiempoToken} mono />}
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-400">
          Firma electrónica conforme a la Ley 527 de 1999 (art. 7) y el Decreto 1074 de 2015 — hash SHA-256,
          identidad del firmante y sello de tiempo. Documento de uso interno; contiene datos personales
          (Ley 1581 de 2012), no debe publicarse sin control de acceso.
        </p>
      </div>
    </section>
  );
}

function Dato({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-stone-400">{k}</dt>
      <dd className={`break-all text-stone-800 ${mono ? "font-mono text-[11px]" : ""}`}>{v}</dd>
    </div>
  );
}
