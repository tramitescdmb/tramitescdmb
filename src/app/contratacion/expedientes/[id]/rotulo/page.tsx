import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerExpedienteContractual } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { BotonImprimir } from "@/components/BotonImprimir";
import { formatearFecha } from "@/lib/fecha";
import { codigoBarrasRadicado, qrVerificacion } from "@/lib/rotulo";
import { ETIQUETA_ETAPA, ETIQUETA_MODALIDAD } from "@/lib/contratacion";

export default async function RotuloExpedienteContractualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);

  const [expediente, config, h] = await Promise.all([
    db.expedienteContractual.findUnique({
      where: { id },
      include: { dependenciaSolicitante: { select: { nombre: true } }, contratista: { select: { nombreORazonSocial: true } } },
    }),
    getConfiguracionSitio(),
    headers(),
  ]);
  if (!expediente) notFound();
  if (!puedeVerExpedienteContractual(permisos, expediente)) redirect("/contratacion");

  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "";
  const base = `${proto}://${host}`;

  const barras = codigoBarrasRadicado(expediente.numero);
  const qr = qrVerificacion(base, expediente.numero);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <style>{`@media print { @page { size: 105mm 65mm; margin: 4mm } body { background: #fff } }`}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link href={`/contratacion/expedientes/${id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </Link>
        <BotonImprimir>Imprimir rótulo</BotonImprimir>
      </div>

      <div className="mx-auto w-[105mm] rounded-lg border border-stone-200 bg-white p-[5mm] text-stone-900 print:w-full print:rounded-none print:border-0 print:p-0">
        <div className="flex items-center gap-2 border-b border-stone-200 pb-1.5">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-6 w-auto" />
          ) : (
            <span className="text-sm font-bold text-cdmb-800">CDMB</span>
          )}
          <span className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-stone-600">
            Corporación Autónoma Regional para la<br />Defensa de la Meseta de Bucaramanga
          </span>
        </div>

        <div className="mt-1.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-stone-500">
              Expediente contractual — {expediente.cerrado ? "Cerrado" : ETIQUETA_ETAPA[expediente.etapaActual]}
            </p>
            <p className="font-mono text-lg font-bold leading-tight tracking-tight text-cdmb-900">{expediente.numero}</p>
            <p className="text-[9px] text-stone-600">{formatearFecha(expediente.createdAt)}</p>
          </div>
          <div
            className="h-[17mm] w-[17mm] flex-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        </div>

        <div className="mt-2 h-[13mm] w-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: barras }} />

        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-stone-200 pt-1 text-[8.5px] text-stone-600">
          <span>Dependencia: <strong className="text-stone-800">{expediente.dependenciaSolicitante.nombre}</strong></span>
          <span>Modalidad: <strong className="text-stone-800">{ETIQUETA_MODALIDAD[expediente.modalidadSeleccion]}</strong></span>
          <span>Contratista: <strong className="text-stone-800">{expediente.contratista?.nombreORazonSocial ?? "—"}</strong></span>
          <span>Estado: <strong className="text-stone-800">{expediente.cerrado ? "Cerrado" : "Abierto"}</strong></span>
        </div>
        <p className="mt-1 text-[7.5px] leading-tight text-stone-400">
          Verifique en {base.replace(/^https?:\/\//, "")}/verificar · Manual de Contratación A-BS-MA01
        </p>
      </div>
    </div>
  );
}
