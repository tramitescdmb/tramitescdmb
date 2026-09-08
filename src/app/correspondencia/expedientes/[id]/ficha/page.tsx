import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerNivelAccesoExpediente } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { ETIQUETA_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { BotonImprimir } from "@/components/BotonImprimir";
import { formatearFechaHoraLarga as fechaHora } from "@/lib/fecha";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="w-48 flex-none font-medium text-stone-500">{etiqueta}</span>
      <span className="text-stone-900">{valor || "—"}</span>
    </div>
  );
}

/** Ficha imprimible del expediente documental — MoReq 4.8 ("formas flexibles de imprimir documentos y sus
 * metadatos"): la constancia de una comunicación ya cubre el radicado individual; esta cubre el expediente
 * completo (metadatos + índice de documentos), que antes solo se podía exportar como CSV/XML de datos. */
export default async function FichaExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);

  const [expediente, config] = await Promise.all([
    db.expedienteDocumental.findUnique({
      where: { id },
      include: {
        dependencia: { select: { nombre: true } },
        serie: { select: { codigo: true, nombre: true } },
        subserie: { select: { codigo: true, nombre: true } },
        creadoPor: { select: { nombre: true } },
        cerradoPor: { select: { nombre: true } },
        documentos: { orderBy: { ordenIndice: "asc" }, select: { ordenIndice: true, nombre: true, tamanoBytes: true, hashSha256: true } },
      },
    }),
    getConfiguracionSitio(),
  ]);
  if (!expediente) notFound();
  if (!puedeVerNivelAccesoExpediente(permisos, expediente)) redirect("/correspondencia/expedientes");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/correspondencia/expedientes/${id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </Link>
        <BotonImprimir>Imprimir ficha</BotonImprimir>
      </div>

      <div className="rounded-xl border border-stone-300 bg-white p-8 print:border-0 print:p-0">
        <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-12 w-auto" />
          ) : (
            <span className="text-lg font-bold text-cdmb-700">CDMB</span>
          )}
          <div>
            <p className="text-sm font-semibold text-stone-900">Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga</p>
            <p className="text-xs text-stone-500">Archivo general — Ficha de expediente documental</p>
          </div>
        </div>

        <div className="my-6 text-center">
          <p className="text-xs uppercase tracking-wide text-stone-500">Número de expediente</p>
          <p className="text-2xl font-bold tracking-tight text-cdmb-800">{expediente.numero}</p>
          <p className="text-xs text-stone-500">Abierto el {fechaHora(expediente.fechaApertura)}</p>
        </div>

        <div className="divide-y divide-stone-100">
          <Dato etiqueta="Asunto" valor={expediente.asunto} />
          <Dato etiqueta="Descripción" valor={expediente.descripcion} />
          <Dato etiqueta="Dependencia" valor={expediente.dependencia.nombre} />
          <Dato etiqueta="Clasificación (TRD)" valor={expediente.serie ? `${expediente.serie.codigo} — ${expediente.serie.nombre}${expediente.subserie ? ` / ${expediente.subserie.nombre}` : ""}` : "Sin clasificar"} />
          <Dato etiqueta="Estado" valor={expediente.estado === "ABIERTO" ? "Abierto" : "Cerrado"} />
          {expediente.estado === "CERRADO" && (
            <>
              <Dato etiqueta="Fecha de cierre" valor={expediente.fechaCierre ? fechaHora(expediente.fechaCierre) : null} />
              <Dato etiqueta="Cerrado por" valor={expediente.cerradoPor?.nombre} />
              <Dato etiqueta="Hash del índice (SHA-256)" valor={expediente.indiceHash ? <span className="font-mono text-xs">{expediente.indiceHash}</span> : null} />
            </>
          )}
          <Dato etiqueta="Nivel de acceso (Ley 1712/2014)" valor={ETIQUETA_NIVEL_ACCESO[expediente.nivelAcceso]} />
          <Dato etiqueta="Abierto por" valor={expediente.creadoPor.nombre} />
          <Dato etiqueta="Total de documentos" valor={expediente.documentos.length} />
        </div>

        {expediente.documentos.length > 0 && (
          <div className="mt-6 border-t border-stone-200 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Índice de documentos</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-1 pr-2 font-medium">No.</th>
                  <th className="py-1 pr-2 font-medium">Nombre</th>
                  <th className="py-1 pr-2 text-right font-medium">Tamaño</th>
                  <th className="py-1 font-medium">SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {expediente.documentos.map((d) => (
                  <tr key={d.ordenIndice}>
                    <td className="py-1 pr-2 font-mono text-stone-500">{String(d.ordenIndice).padStart(3, "0")}</td>
                    <td className="py-1 pr-2 text-stone-800">{d.nombre}</td>
                    <td className="py-1 pr-2 text-right text-stone-500">{Math.round(d.tamanoBytes / 1024)} KB</td>
                    <td className="py-1 font-mono text-stone-400">{d.hashSha256 ? `${d.hashSha256.slice(0, 16)}…` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 border-t border-stone-200 pt-4 text-[11px] leading-relaxed text-stone-500">
          Esta ficha certifica el estado del expediente electrónico de archivo en el Sistema de Gestión de
          Documentos Electrónicos de Archivo (SGDEA) de la CDMB (Art. 4.3.2 Acuerdo 001/2024 AGN). Toda
          actuación sobre este expediente queda registrada en una bitácora de auditoría inalterable.
        </p>
      </div>
    </div>
  );
}
