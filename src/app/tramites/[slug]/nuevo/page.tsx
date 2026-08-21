import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHelp } from "@/components/Field";
import { NuevoExpedienteForm } from "@/components/NuevoExpedienteForm";
import { getTramitePorSlug } from "@/lib/tramites-data";

export default async function NuevoExpedientePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tramite = await getTramitePorSlug(slug);

  if (!tramite) notFound();

  const flujoInicial = tramite.flujos.find((f) => f.esFlujoInicial) ?? tramite.flujos[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/tramites/${tramite.slug}`} className="text-sm text-cdmb-700 hover:underline">
          ← {tramite.nombre}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">Nuevo expediente</h1>
        <p className="text-sm text-stone-500">Trámite: {tramite.nombre} ({tramite.codigo})</p>
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
        flujos={tramite.flujos.map((f) => ({ id: f.id, nombre: f.nombre }))}
        flujoInicialId={flujoInicial.id}
      />
    </div>
  );
}
