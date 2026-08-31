import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, FileText, User } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getHistoricoResolucion } from "@/lib/sinca-data";
import { sincaConfigurado, obtenerResolucionDetalle, type SincaResolucionDetalleApi } from "@/lib/sinca";

function fecha(valor: Date | string | null | undefined) {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor.includes(" ") ? valor.replace(" ", "T") : valor) : valor;
  if (Number.isNaN(d.getTime())) return "—";
  const a = d.getUTCFullYear();
  if (a < 1980 || a > new Date().getUTCFullYear() + 1) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

function nombreArchivo(camino: string | null | undefined) {
  if (!camino) return null;
  return camino.split(/[\\/]/).pop() || camino;
}

export default async function HistoricoDetallePage({ params }: { params: Promise<{ nro: string }> }) {
  const { nro } = await params;
  const nroSolicitud = parseInt(nro, 10);
  if (!Number.isFinite(nroSolicitud)) notFound();
  if (!sincaConfigurado()) return null;

  const base = await getHistoricoResolucion(nroSolicitud);
  if (!base) notFound();

  const session = await getSession();
  const esAdmin = session?.rol === "ADMIN";

  // Detalle en vivo: trae documentos e interesado. Si el API falla, se muestra
  // solo lo que hay en el espejo local.
  let detalle: SincaResolucionDetalleApi | null = null;
  let errorDetalle = false;
  try {
    detalle = await obtenerResolucionDetalle(nroSolicitud);
  } catch {
    errorDetalle = true;
  }

  const documentos = detalle?.emision_documentos ?? [];
  const resolucionDoc = documentos.find((d) => d.documentos_cdmb?.tipodoc_dcc?.value === "R");
  // La fecha de la resolución en SINCA 1.0 a veces tiene el año mal digitado; se
  // usa la fecha de emisión/vigencia del documento cuando está disponible.
  const fechaResolucionReal =
    fecha(base.fechaResolucion) !== "—"
      ? fecha(base.fechaResolucion)
      : fecha(resolucionDoc?.fechaemision_edc ?? resolucionDoc?.fechavigencia_edc);

  const interesado = detalle?.interesado?.[0]?.nit as Record<string, unknown> | undefined;
  const nombreInteresado =
    (interesado?.razon_soc_nit as string) ||
    [interesado?.primer_nom_nit, interesado?.segundo_nom_nit, interesado?.primer_ape_nit, interesado?.segundo_ape_nit]
      .filter(Boolean)
      .join(" ") ||
    (interesado?.nombre_nit as string) ||
    base.representanteLegal;
  const nitInteresado = interesado?.numero_nit
    ? `${interesado.numero_nit}${interesado.digito_nit != null ? `-${interesado.digito_nit}` : ""}`
    : base.idRepresentante;

  const datos: { etiqueta: string; valor: string | null }[] = [
    { etiqueta: "Número de solicitud (SINCA 1.0)", valor: String(base.nroSolicitud) },
    { etiqueta: "Número de resolución", valor: base.numeroResolucion },
    { etiqueta: "Fecha de la resolución", valor: fechaResolucionReal },
    { etiqueta: "Fecha de recibido", valor: fecha(base.fechaRecibido) },
    { etiqueta: "Expediente", valor: base.expediente },
    { etiqueta: "Tipo de trámite", valor: base.tipoSolicitud },
    { etiqueta: "Modalidad", valor: base.indTipoSolicitud },
    { etiqueta: "Estado", valor: base.estado },
    { etiqueta: "Origen", valor: detalle?.origen_sol?.label ?? base.origen },
    { etiqueta: "Departamento", valor: detalle?.municipios?.departamentos?.nombre_dpt ?? base.departamento },
    { etiqueta: "Municipio", valor: detalle?.municipios?.nombre_mun ?? base.municipio },
    { etiqueta: "Vereda / barrio", valor: detalle?.vereda ?? detalle?.barrio ?? base.barrio },
    { etiqueta: "Dirección", valor: detalle?.direccion_sol ?? null },
  ];

  return (
    <div className="space-y-5">
      <Link href="/historico/solicitudes" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al listado
      </Link>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">Resolución {base.numeroResolucion ?? "—"}</h2>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{base.estado ?? "—"}</span>
        </div>
        <p className="mt-2 text-sm text-stone-700">{base.proyecto || "Sin descripción del proyecto."}</p>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {datos.map((f) => (
            <div key={f.etiqueta} className="border-b border-stone-100 pb-2">
              <dt className="text-xs text-stone-400">{f.etiqueta}</dt>
              <dd className="text-sm text-stone-800">{f.valor && f.valor !== "null" ? f.valor : "—"}</dd>
            </div>
          ))}
        </dl>

        {base.lat != null && base.lon != null && (
          <div className="mt-5 flex items-center gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <MapPin className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            <span>
              Ubicación aproximada: {base.lat.toFixed(5)}, {base.lon.toFixed(5)}{" "}
              <a
                href={`https://www.openstreetmap.org/?mlat=${base.lat}&mlon=${base.lon}#map=15/${base.lat}/${base.lon}`}
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

      {/* Documentos de la resolución */}
      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <FileText className="h-4 w-4 text-cdmb-600" aria-hidden />
          Documentos de la resolución
        </h3>

        {errorDetalle ? (
          <p className="mt-3 text-sm text-stone-500">
            No fue posible consultar los documentos en SINCA 1.0 en este momento. Intente más tarde.
          </p>
        ) : documentos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Esta solicitud no tiene documentos registrados en SINCA 1.0.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {documentos.map((d, i) => {
              const archivo = nombreArchivo(d.caminopdf_edc);
              return (
                <li key={i} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-stone-800">
                      {d.documentos_cdmb?.nombre_dcc ?? d.documentos_cdmb?.tipodoc_dcc?.label ?? "Documento"}
                    </p>
                    <span className="text-xs text-stone-400">
                      {d.documentos_cdmb?.tipodoc_dcc?.label ?? "—"}
                      {d.nrodocumento_edc ? ` · N.º ${d.nrodocumento_edc}` : ""}
                    </span>
                  </div>
                  {d.referencia_edc && <p className="mt-1 text-sm text-stone-600">{d.referencia_edc}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-500">
                    <span>Emisión: {fecha(d.fechaemision_edc)}</span>
                    <span>Vigencia: {fecha(d.fechavigencia_edc)}</span>
                    {d.fechanotificacion_edc && <span>Notificación: {fecha(d.fechanotificacion_edc)}</span>}
                    {d.foliosdoc_edc != null && <span>{d.foliosdoc_edc} folios</span>}
                  </div>
                  {archivo && (
                    <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                      Archivo en el sistema documental de SINCA 1.0: <span className="font-mono">{archivo}</span>. Esta
                      consulta no permite descargar el PDF todavía.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Interesado / solicitante */}
      {nombreInteresado && (
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <User className="h-4 w-4 text-cdmb-600" aria-hidden />
            Interesado
          </h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs text-stone-400">Nombre / razón social</dt>
              <dd className="text-stone-800">{nombreInteresado}</dd>
            </div>
            {nitInteresado && (
              <div>
                <dt className="text-xs text-stone-400">Identificación</dt>
                <dd className="text-stone-800">{nitInteresado}</dd>
              </div>
            )}
            {(interesado?.correo_nit as string) || base.correo ? (
              <div>
                <dt className="text-xs text-stone-400">Correo</dt>
                <dd className="text-stone-800">{(interesado?.correo_nit as string) || base.correo}</dd>
              </div>
            ) : null}
            {(interesado?.direcc_nit as string) || detalle?.direccion_sol ? (
              <div>
                <dt className="text-xs text-stone-400">Dirección</dt>
                <dd className="text-stone-800">{(interesado?.direcc_nit as string) || detalle?.direccion_sol}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      )}

      {esAdmin && detalle && (
        <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-stone-500">Datos técnicos (solo administradores)</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">
            {JSON.stringify(detalle, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
