import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { BotonImprimir } from "@/components/BotonImprimir";

const fechaHora = (d: Date) => d.toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="w-44 flex-none font-medium text-stone-500">{etiqueta}</span>
      <span className="text-stone-900">{valor || "—"}</span>
    </div>
  );
}

export default async function ConstanciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const [c, config] = await Promise.all([
    db.comunicacion.findUnique({
      where: { id },
      include: {
        dependenciaDestino: { select: { nombre: true } },
        serie: { select: { codigo: true, nombre: true } },
        subserie: { select: { codigo: true, nombre: true } },
        radicadoPor: { select: { nombre: true } },
        _count: { select: { documentos: true } },
      },
    }),
    getConfiguracionSitio(),
  ]);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/correspondencia/${id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </Link>
        <BotonImprimir>Imprimir constancia</BotonImprimir>
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
            <p className="text-xs text-stone-500">Ventanilla Única de Correspondencia — Constancia de radicación</p>
          </div>
        </div>

        <div className="my-6 text-center">
          <p className="text-xs uppercase tracking-wide text-stone-500">Número de radicado</p>
          <p className="text-2xl font-bold tracking-tight text-cdmb-800">{c.radicado}</p>
          <p className="text-xs text-stone-500">Radicado el {fechaHora(c.fechaRadicacion)}</p>
        </div>

        <div className="divide-y divide-stone-100">
          <Dato etiqueta="Tipo" valor="Comunicación recibida" />
          <Dato etiqueta="Remitente" valor={c.terceroNombre} />
          <Dato etiqueta="Identificación" valor={[c.terceroTipoIdentificacion, c.terceroIdentificacion].filter(Boolean).join(" ")} />
          <Dato etiqueta="Asunto" valor={c.asunto} />
          <Dato etiqueta="Folios" valor={c.folios} />
          <Dato etiqueta="Anexos" valor={c.anexosDescripcion} />
          <Dato etiqueta="Medio de recepción" valor={c.medio} />
          <Dato etiqueta="Dependencia destino" valor={c.dependenciaDestino?.nombre} />
          <Dato etiqueta="Clasificación (TRD)" valor={c.serie ? `${c.serie.codigo} — ${c.serie.nombre}${c.subserie ? ` / ${c.subserie.nombre}` : ""}` : null} />
          <Dato etiqueta="Documentos adjuntos" valor={c._count.documentos} />
          <Dato etiqueta="Radicado por" valor={c.radicadoPor?.nombre} />
        </div>

        <p className="mt-6 border-t border-stone-200 pt-4 text-[11px] leading-relaxed text-stone-500">
          Esta constancia certifica la radicación de la comunicación en el Sistema de Gestión de Documentos Electrónicos
          de Archivo (SGDEA) de la CDMB, con número consecutivo inalterable conforme al Acuerdo 060 de 2001 del Archivo
          General de la Nación. La radicación y toda actuación posterior quedan registradas en una bitácora de auditoría
          inalterable.
        </p>
      </div>
    </div>
  );
}
