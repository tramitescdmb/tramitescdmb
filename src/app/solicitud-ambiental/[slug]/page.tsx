import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoSolicitud, PasosSolicitud } from "@/components/solicitud-ambiental/Encabezado";
import { NuevoExpedienteForm } from "@/components/NuevoExpedienteForm";
import { getTramitePorSlug } from "@/lib/tramites-data";
import { aplicaDatosPredio } from "@/lib/tramite-datos-predio";
import { nombreFlujo } from "@/lib/flujo-nombre";
import { cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Solicitud ambiental — CDMB",
  description: "Radique en línea su solicitud de trámite ambiental ante la CDMB.",
};

export default async function SolicitudAmbientalTramitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ flujo?: string }>;
}) {
  const { slug } = await params;
  const { flujo: flujoCodigo } = await searchParams;
  const tramite = await getTramitePorSlug(slug);
  if (!tramite || !tramite.activo || tramite.flujos.length === 0 || tramite.codigo.startsWith("IE-")) notFound();

  const flujoEnfocado = flujoCodigo ? tramite.flujos.find((f) => f.codigo === flujoCodigo) : undefined;
  const flujos = flujoEnfocado ? [flujoEnfocado] : tramite.flujos;
  const flujoInicial = flujoEnfocado ?? tramite.flujos.find((f) => f.esFlujoInicial) ?? tramite.flujos[0]!;
  const nombre = flujoEnfocado ? nombreFlujo(flujoEnfocado.nombre) : tramite.nombre;
  const cuenta = await cuentaEnSesion();

  return (
    <div className="space-y-5">
      <Link href="/solicitud-ambiental" className="text-xs font-medium uppercase tracking-wide text-cdmb-700 hover:underline">
        ← Elegir otro trámite
      </Link>
      <EncabezadoSolicitud titulo={nombre}>
        Complete los datos y adjunte los documentos; los campos marcados con * son obligatorios. Al radicar recibirá un número de
        solicitud para consultar el estado.
      </EncabezadoSolicitud>
      <PasosSolicitud actual={2} />
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
        flujos={flujos.map((f) => ({ id: f.id, nombre: nombreFlujo(f.nombre) }))}
        flujoInicialId={flujoInicial.id}
        mostrarDatosPredio={aplicaDatosPredio(tramite.codigo)}
        publico
        cuentaCiudadana={
          cuenta?.completa && cuenta.identificacion
            ? { correo: cuenta.correo, tipo: cuenta.tipo, identificacion: cuenta.identificacion, telefono: cuenta.telefono }
            : null
        }
      />
    </div>
  );
}
