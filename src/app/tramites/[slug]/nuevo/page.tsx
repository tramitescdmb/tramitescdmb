import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Field, SectionHelp } from "@/components/Field";

export default async function NuevoExpedientePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tramite = await db.tramiteTipo.findUnique({
    where: { slug },
    include: {
      documentosRequeridos: { orderBy: { orden: "asc" } },
      flujos: { orderBy: { orden: "asc" } },
    },
  });

  if (!tramite) notFound();

  const flujoInicial = tramite.flujos.find((f) => f.esFlujoInicial) ?? tramite.flujos[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/tramites/${tramite.slug}`} className="text-sm text-cdmb-700 hover:underline">
          ← {tramite.nombre}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Nuevo expediente</h1>
        <p className="text-sm text-gray-500">Trámite: {tramite.nombre} ({tramite.codigo})</p>
      </div>

      <SectionHelp>
        Este formulario <strong>radica</strong> la solicitud: crea el expediente en estado
        &quot;Radicado&quot; con los datos del solicitante y los documentos que ya tengas a la mano.
        Los pasos siguientes del trámite (visitas, conceptos técnicos, resoluciones, etc.) se registran
        después, desde la página del expediente.
      </SectionHelp>

      <form action="/api/expedientes" method="post" encType="multipart/form-data" className="space-y-8">
        <input type="hidden" name="tramiteTipoId" value={tramite.id} />

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">1. Datos del solicitante</h2>

          {tramite.flujos.length > 1 && (
            <Field
              label="Tipo de solicitud"
              required
              help="Elige qué está pidiendo el solicitante — cada trámite puede tener más de una modalidad (por ejemplo, una solicitud nueva o la renovación de un permiso vigente)."
            >
              <div className="space-y-2">
                {tramite.flujos.map((f) => (
                  <label key={f.id} className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="flujoId"
                      value={f.id}
                      defaultChecked={f.id === flujoInicial.id}
                      required
                      className="mt-0.5"
                    />
                    {f.nombre}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {tramite.flujos.length === 1 && (
            <input type="hidden" name="flujoId" value={tramite.flujos[0].id} />
          )}

          <Field label="Tipo de solicitante" required help="¿A nombre de quién queda el expediente?">
            <select
              name="solicitanteTipo"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            >
              <option value="NATURAL">Persona natural</option>
              <option value="JURIDICA">Persona jurídica (empresa, entidad)</option>
            </select>
          </Field>

          <Field
            label="Nombre o razón social"
            required
            help="Nombre completo de la persona, o razón social si es una empresa/entidad."
          >
            <input
              name="solicitanteNombre"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="Ej: Juan Pérez Gómez / Industrias ABC S.A.S."
            />
          </Field>

          <Field
            label="Identificación"
            required
            help="Cédula de ciudadanía (persona natural) o NIT (persona jurídica)."
          >
            <input
              name="solicitanteIdentificacion"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="Ej: 91234567 o 900123456-1"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Correo electrónico" help="Para notificaciones, si el solicitante autoriza este medio.">
              <input
                type="email"
                name="solicitanteEmail"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="correo@ejemplo.com"
              />
            </Field>
            <Field label="Teléfono" help="Número de contacto del solicitante.">
              <input
                name="solicitanteTelefono"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="Ej: 3001234567"
              />
            </Field>
          </div>

          <Field label="Dirección" help="Dirección del predio, proyecto o del solicitante, según aplique.">
            <input
              name="solicitanteDireccion"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">2. Documentos</h2>
            <p className="text-xs text-gray-500">
              Sube lo que el solicitante ya trajo. Si te falta algo, puedes crear el expediente igual y
              subirlo después — o pedirle al solicitante la información faltante desde el detalle del
              expediente.
            </p>
          </div>

          {tramite.documentosRequeridos.length === 0 && (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
              Este trámite no tiene una lista fija de documentos en el procedimiento oficial — usa el campo
              de &quot;otros documentos&quot; más abajo para adjuntar lo que corresponda.
            </p>
          )}

          {tramite.documentosRequeridos.map((doc) => (
            <Field
              key={doc.id}
              label={doc.nombre}
              required={doc.obligatorio}
              help={doc.notas ?? (doc.obligatorio ? "Documento obligatorio." : "Documento opcional / aplica solo en algunos casos.")}
            >
              <input
                type="file"
                name={`doc_${doc.id}`}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-cdmb-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cdmb-700 hover:file:bg-cdmb-100"
              />
            </Field>
          ))}

          <Field
            label="Otros documentos"
            help="Cualquier otro soporte que no esté en la lista de arriba (puedes seleccionar varios archivos)."
          >
            <input
              type="file"
              name="documentos_extra"
              multiple
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </Field>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link href={`/tramites/${tramite.slug}`} className="text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
          >
            Radicar expediente
          </button>
        </div>
      </form>
    </div>
  );
}
