import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarFormatosVisita } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { estructuraDesdeJson } from "@/lib/formatos-visita-db";
import { DocumentoFormato } from "@/components/formatos/DocumentoFormato";
import { EstiloImpresionFormato } from "@/components/formatos/EstiloImpresionFormato";
import { BotonImprimir } from "@/components/BotonImprimir";

export default async function DocumentoFormatoEnBlancoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const { id } = await params;
  const { version } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarFormatosVisita(permisos)) notFound();

  const formato = await db.formatoVisita.findUnique({ where: { id }, include: { versiones: { orderBy: { numero: "desc" } } } });
  if (!formato) notFound();
  const numero = Number(version);
  const v = Number.isInteger(numero) ? formato.versiones.find((x) => x.numero === numero) : (formato.versiones.find((x) => x.estado === "BORRADOR") ?? formato.versiones[0]);
  if (!v) notFound();
  const config = await getConfiguracionSitio();

  return (
    <div className="space-y-3">
      <EstiloImpresionFormato />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/planeador/formatos/${id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al editor
        </Link>
        <span className="text-xs text-stone-500">
          Versión {v.numero} · {v.estado === "PUBLICADA" ? "vigente" : v.estado === "BORRADOR" ? "borrador" : "reemplazada"} · en blanco
        </span>
        <BotonImprimir variante="secundario">Descargar / imprimir</BotonImprimir>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft print:border-0 print:p-0 print:shadow-none">
        <DocumentoFormato
          encabezado={{ codigo: formato.codigo, titulo: formato.titulo, versionDocumento: formato.versionDocumento, fechaDocumento: formato.fechaDocumento, logoUrl: config.logoUrl }}
          estructura={estructuraDesdeJson(v.estructura)}
          respuestas={{}}
          precarga={{}}
          enBlanco
        />
      </div>
    </div>
  );
}
