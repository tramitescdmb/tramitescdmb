import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHelp } from "@/components/Field";
import { NuevoExpedienteForm } from "@/components/NuevoExpedienteForm";
import { getTramitePorSlug } from "@/lib/tramites-data";

export default async function NuevoExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ flujo?: string }>;
}) {
  const { slug } = await params;
  const { flujo: flujoCodigoFoco } = await searchParams;

  const tramite = await getTramitePorSlug(slug);

  if (!tramite) notFound();

  // Si se llega desde una tarjeta de un flujo específico (ej. "Concesión de Aguas Superficiales"),
  // ese flujo ya quedó decidido — no hace falta volver a preguntar "Tipo de solicitud".
  const flujoEnfocado = flujoCodigoFoco ? tramite.flujos.find((f) => f.codigo === flujoCodigoFoco) : undefined;
  const flujosParaElegir = flujoEnfocado ? [flujoEnfocado] : tramite.flujos;

  const flujoInicial = flujoEnfocado ?? tramite.flujos.find((f) => f.esFlujoInicial) ?? tramite.flujos[0];
  if (!flujoInicial) notFound();

  const nombreMostrado = flujoEnfocado?.nombre ?? tramite.nombre;
  const hrefVolver = flujoEnfocado ? `/tramites/${tramite.slug}?flujo=${flujoEnfocado.codigo}` : `/tramites/${tramite.slug}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={hrefVolver} className="text-sm text-cdmb-700 hover:underline">
          ← {nombreMostrado}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">Nuevo expediente</h1>
        <p className="text-sm text-stone-500">Trámite: {nombreMostrado} ({tramite.codigo})</p>
      </div>

      <SectionHelp>
        Este formulario <strong>radica</strong> la solicitud: crea el expediente en estado
        &quot;Radicado&quot; con los datos del solicitante y los documentos que ya tengas a la mano.
        Los pasos siguientes del trámite (visitas, conceptos técnicos, resoluciones, etc.) se registran
        después, desde la página del expediente.
      </SectionHelp>

      <NuevoExpedienteForm
        tramiteId={tramite.id}
        tramiteSlug={tramite.slug}
        documentosRequeridos={tramite.documentosRequeridos.map((d) => ({
          id: d.id,
          nombre: d.nombre,
          obligatorio: d.obligatorio,
          notas: d.notas,
        }))}
        flujos={flujosParaElegir.map((f) => ({ id: f.id, nombre: f.nombre }))}
        flujoInicialId={flujoInicial.id}
      />
    </div>
  );
}
