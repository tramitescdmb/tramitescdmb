import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { BotonImprimir } from "@/components/BotonImprimir";
import { formatearFechaHoraLarga as fechaHora } from "@/lib/fecha";
import { codigoBarrasRadicado, qrVerificacion } from "@/lib/rotulo";

const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Recibida", ENVIADA: "Enviada", INTERNA: "Memorando" };

export default async function RotuloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const [c, config, h] = await Promise.all([
    db.comunicacion.findUnique({
      where: { id },
      include: {
        dependenciaDestino: { select: { nombre: true } },
        dependenciaOrigen: { select: { nombre: true } },
        serie: { select: { codigo: true } },
        radicadoPor: { select: { nombre: true } },
      },
    }),
    getConfiguracionSitio(),
    headers(),
  ]);
  if (!c) notFound();

  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "";
  const base = `${proto}://${host}`;

  const barras = codigoBarrasRadicado(c.radicado);
  const qr = qrVerificacion(base, c.radicado);
  const dependencia = c.tipo === "RECIBIDA" ? c.dependenciaDestino?.nombre : c.dependenciaOrigen?.nombre;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <style>{`@media print { @page { size: 105mm 65mm; margin: 4mm } body { background: #fff } }`}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link href={`/correspondencia/${id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </Link>
        <BotonImprimir>Imprimir rótulo</BotonImprimir>
      </div>

      <p className="print:hidden text-xs text-stone-500">
        El código de barras se genera automáticamente del número de radicado. Imprima este rótulo y adhiéralo
        en la primera hoja del documento físico. El QR abre la verificación pública del radicado.
      </p>

      {/* Etiqueta — lo único que se imprime */}
      <div className="mx-auto w-[105mm] rounded-lg border border-stone-300 bg-white p-[5mm] text-stone-900 print:w-full print:rounded-none print:border-0 print:p-0">
        <div className="flex items-center gap-2 border-b border-stone-300 pb-1.5">
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
              Radicado de correspondencia — {ETIQUETA_TIPO[c.tipo] ?? c.tipo}
            </p>
            <p className="font-mono text-lg font-bold leading-tight tracking-tight text-cdmb-900">{c.radicado}</p>
            <p className="text-[9px] text-stone-600">{fechaHora(c.fechaRadicacion)}</p>
          </div>
          <div
            className="h-[17mm] w-[17mm] flex-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        </div>

        <div className="mt-2 h-[13mm] w-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: barras }} />

        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-stone-200 pt-1 text-[8.5px] text-stone-600">
          <span>Dependencia: <strong className="text-stone-800">{dependencia ?? "—"}</strong></span>
          <span>Folios: <strong className="text-stone-800">{c.folios}</strong></span>
          <span>Serie (TRD): <strong className="text-stone-800">{c.serie?.codigo ?? "—"}</strong></span>
          <span>Radicó: <strong className="text-stone-800">{c.radicadoPor?.nombre ?? "Ventanilla"}</strong></span>
        </div>
        <p className="mt-1 text-[7.5px] leading-tight text-stone-400">
          Verifique en {base.replace(/^https?:\/\//, "")}/verificar · consecutivo inalterable, Acuerdo 060/2001 AGN
        </p>
      </div>
    </div>
  );
}
