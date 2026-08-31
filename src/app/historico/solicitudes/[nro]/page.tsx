import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { getHistoricoResolucion } from "@/lib/sinca-data";
import { sincaConfigurado } from "@/lib/sinca";

function fecha(d: Date | null) {
  return d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "—";
}

export default async function HistoricoDetallePage({ params }: { params: Promise<{ nro: string }> }) {
  const { nro } = await params;
  const nroSolicitud = parseInt(nro, 10);
  if (!Number.isFinite(nroSolicitud)) notFound();
  if (!sincaConfigurado()) return null;

  const r = await getHistoricoResolucion(nroSolicitud);
  if (!r) notFound();

  const raw = (r.raw ?? {}) as Record<string, unknown>;

  const datos: { etiqueta: string; valor: string | null }[] = [
    { etiqueta: "Número de solicitud (SINCA 1.0)", valor: String(r.nroSolicitud) },
    { etiqueta: "Número de resolución", valor: r.numeroResolucion },
    { etiqueta: "Fecha de la resolución", valor: fecha(r.fechaResolucion) },
    { etiqueta: "Fecha de recibido", valor: fecha(r.fechaRecibido) },
    { etiqueta: "Expediente", valor: r.expediente },
    { etiqueta: "Tipo de trámite", valor: r.tipoSolicitud },
    { etiqueta: "Tipo de solicitud", valor: r.indTipoSolicitud },
    { etiqueta: "Estado", valor: r.estado },
    { etiqueta: "Origen", valor: r.origen },
    { etiqueta: "Departamento", valor: r.departamento },
    { etiqueta: "Municipio", valor: r.municipio },
    { etiqueta: "Barrio / sector", valor: r.barrio },
    { etiqueta: "Representante legal", valor: r.representanteLegal },
    { etiqueta: "Identificación del representante", valor: r.idRepresentante },
    { etiqueta: "Correo", valor: r.correo },
    { etiqueta: "Documentos emitidos", valor: String(r.cantidadDocumentos) },
    { etiqueta: "Interesados", valor: String(r.cantidadInteresados) },
  ];

  return (
    <div className="space-y-5">
      <Link href="/historico/solicitudes" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al listado
      </Link>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">
            Resolución {r.numeroResolucion ?? "—"}
          </h2>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{r.estado ?? "—"}</span>
        </div>
        <p className="mt-2 text-sm text-stone-700">{r.proyecto || "Sin descripción del proyecto."}</p>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {datos.map((f) => (
            <div key={f.etiqueta} className="border-b border-stone-100 pb-2">
              <dt className="text-xs text-stone-400">{f.etiqueta}</dt>
              <dd className="text-sm text-stone-800">{f.valor && f.valor !== "null" ? f.valor : "—"}</dd>
            </div>
          ))}
        </dl>

        {r.lat != null && r.lon != null && (
          <div className="mt-5 flex items-center gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <MapPin className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            <span>
              Ubicación aproximada: {r.lat.toFixed(5)}, {r.lon.toFixed(5)}{" "}
              <a
                href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=15/${r.lat}/${r.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cdmb-700 underline"
              >
                ver en el mapa
              </a>
            </span>
          </div>
        )}
      </div>

      <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-stone-700">Registro original de SINCA 1.0</summary>
        <p className="mt-2 text-xs text-stone-400">
          Datos tal como los entrega el sistema SINCA 1.0, sin transformar.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}
