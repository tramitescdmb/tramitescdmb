import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { prellenadoDesdeVital } from "@/lib/vital-conversion";
import { nombreTramiteVital } from "@/lib/vital";
import { SectionHelp } from "@/components/Field";
import { NuevoExpedienteForm } from "@/components/NuevoExpedienteForm";
import { getTramitePorSlug } from "@/lib/tramites-data";
import { aplicaDatosPredio } from "@/lib/tramite-datos-predio";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeEditarTramite } from "@/lib/permisos";
import { BandaTablero } from "@/components/tablero";

export default async function NuevoExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ flujo?: string; vital?: string }>;
}) {
  const { slug } = await params;
  const { flujo: flujoCodigoFoco, vital: solicitudVitalId } = await searchParams;

  const tramite = await getTramitePorSlug(slug);

  if (!tramite) notFound();

  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeEditarTramite(permisos, tramite.id)) notFound();
  }

  const flujoEnfocado = flujoCodigoFoco ? tramite.flujos.find((f) => f.codigo === flujoCodigoFoco) : undefined;
  const flujosParaElegir = flujoEnfocado ? [flujoEnfocado] : tramite.flujos;

  const flujoInicial = flujoEnfocado ?? tramite.flujos.find((f) => f.esFlujoInicial) ?? tramite.flujos[0];
  if (!flujoInicial) notFound();

  const solicitudVital = solicitudVitalId
    ? await db.solicitudVital.findUnique({
        where: { id: solicitudVitalId },
        include: { documentos: { orderBy: { createdAt: "asc" }, select: { id: true, nombre: true } } },
      })
    : null;
  if (solicitudVitalId && !solicitudVital) notFound();
  if (solicitudVital?.expedienteId) redirect(`/expedientes/${solicitudVital.expedienteId}`);
  const desdeVital = solicitudVital
    ? {
        solicitudId: solicitudVital.id,
        idVital: solicitudVital.idVital,
        tramiteVital: nombreTramiteVital(solicitudVital.idTramiteVital),
        anexos: solicitudVital.documentos,
        anexosReportados: solicitudVital.documentosReportados,
        datos: prellenadoDesdeVital(solicitudVital),
      }
    : undefined;

  const nombreMostrado = flujoEnfocado?.nombre ?? tramite.nombre;
  const hrefVolver = flujoEnfocado ? `/tramites/${tramite.slug}?flujo=${flujoEnfocado.codigo}` : `/tramites/${tramite.slug}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BandaTablero>
        <Link href={hrefVolver} className="text-xs font-medium uppercase tracking-wide text-cdmb-700 hover:underline">
          ← {nombreMostrado}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">
          {desdeVital ? `Convertir en trámite la solicitud VITAL ${desdeVital.idVital}` : "Nuevo expediente"}
        </h1>
        <p className="text-sm text-stone-500">Trámite: {nombreMostrado} ({tramite.codigo})</p>
      </BandaTablero>

      <SectionHelp>
        <strong>Radica</strong> la solicitud: crea el expediente en estado &quot;Radicado&quot;. Los pasos
        siguientes (visitas, conceptos, resoluciones) se registran después, desde la página del expediente.
      </SectionHelp>

      <NuevoExpedienteForm
        tramiteId={tramite.id}
        tramiteSlug={tramite.slug}
        documentosRequeridos={tramite.documentosRequeridos.map((d) => ({
          id: d.id,
          nombre: d.nombre,
          obligatorio: d.obligatorio,
          notas: d.notas,
          aplicaA: d.aplicaA,
        }))}
        flujos={flujosParaElegir.map((f) => ({ id: f.id, nombre: f.nombre }))}
        flujoInicialId={flujoInicial.id}
        mostrarDatosPredio={aplicaDatosPredio(tramite.codigo)}
        desdeVital={desdeVital}
      />
    </div>
  );
}
