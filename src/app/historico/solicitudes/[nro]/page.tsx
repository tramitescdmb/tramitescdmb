import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, FileText, User, ClipboardList } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getHistoricoResolucion } from "@/lib/sinca-data";
import { sincaConfigurado, obtenerResolucionDetalle, type SincaResolucionDetalleApi } from "@/lib/sinca";

function fecha(valor: Date | string | null | undefined) {
  if (!valor) return null;
  const d = typeof valor === "string" ? new Date(valor.includes(" ") ? valor.replace(" ", "T") : valor) : valor;
  if (Number.isNaN(d.getTime())) return null;
  const a = d.getUTCFullYear();
  if (a < 1980 || a > new Date().getUTCFullYear() + 1) return null;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}
const txt = (v: unknown) => (v === null || v === undefined || v === "" || v === "null" ? null : String(v));
function nombreArchivo(camino: string | null | undefined) {
  if (!camino) return null;
  return camino.split(/[\\/]/).pop() || camino;
}

function Campos({ titulo, icon: Icon, campos }: { titulo: string; icon: typeof User; campos: [string, string | null][] }) {
  const visibles = campos.filter(([, v]) => v);
  if (visibles.length === 0) return null;
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Icon className="h-4 w-4 text-cdmb-600" aria-hidden />
        {titulo}
      </h3>
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {visibles.map(([k, v]) => (
          <div key={k} className="border-b border-stone-100 pb-2">
            <dt className="text-xs text-stone-400">{k}</dt>
            <dd className="text-sm text-stone-800">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
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

  let d: SincaResolucionDetalleApi | null = null;
  let errorDetalle = false;
  try {
    d = await obtenerResolucionDetalle(nroSolicitud);
  } catch {
    errorDetalle = true;
  }

  const documentos = d?.emision_documentos ?? [];
  const resolucionDoc = documentos.find((x) => x.documentos_cdmb?.tipodoc_dcc?.value === "R");
  const fechaResolucion =
    fecha(base.fechaResolucion) ?? fecha(resolucionDoc?.fechaemision_edc) ?? fecha(resolucionDoc?.fechavigencia_edc);

  const interesado = d?.interesado?.[0]?.nit as Record<string, unknown> | undefined;
  const nombreInteresado =
    txt(interesado?.razon_soc_nit) ||
    [interesado?.primer_nom_nit, interesado?.segundo_nom_nit, interesado?.primer_ape_nit, interesado?.segundo_ape_nit].filter(Boolean).join(" ") ||
    txt(interesado?.nombre_nit) ||
    base.representanteLegal;
  const nitInteresado = interesado?.numero_nit
    ? `${interesado.numero_nit}${interesado.digito_nit != null ? `-${interesado.digito_nit}` : ""}`
    : base.idRepresentante;

  const datosSolicitud: [string, string | null][] = [
    ["Número de solicitud (SINCA 1.0)", String(base.nroSolicitud)],
    ["Número de resolución", base.numeroResolucion],
    ["Fecha de la resolución", fechaResolucion],
    ["Expediente", base.expediente],
    ["Tipo de trámite", base.tipoSolicitud],
    ["Modalidad", d?.indtiposol_sol?.label ?? base.indTipoSolicitud],
    ["Estado", d?.estado_sol?.label ?? base.estado],
    ["Origen", d?.origen_sol?.label ?? base.origen],
    ["Número de origen (radicado)", txt(d?.nroorigen_sol)],
    ["Año de origen", txt(d?.anoorigen_sol)],
    ["Fecha de recibido", fecha(base.fechaRecibido) ?? fecha(d?.fecharecibido_sol)],
    ["¿Requiere permiso?", d?.requierepermiso_sol?.label ?? null],
    ["Licencia única", d?.licenciaunica_sol?.label ?? null],
    ["Número de título minero", txt(d?.nrotitulomin_tmi)],
    ["Observación", txt(d?.observacion_sol)],
  ];

  const datosUbicacion: [string, string | null][] = [
    ["Departamento", d?.municipios?.departamentos?.nombre_dpt ?? base.departamento],
    ["Municipio", d?.municipios?.nombre_mun ?? base.municipio],
    ["Tipo de centro poblado", d?.tipocenpoblado_sol?.label ?? null],
    ["Vereda", txt(d?.vereda)],
    ["Barrio / sector", txt(d?.barrio) ?? txt(base.barrio)],
    ["Dirección", txt(d?.direccion_sol)],
    ["Clase de suelo", d?.clasesuelo_sol?.label ?? null],
    ["Uso del suelo", d?.usosuelo_sol?.label ?? null],
    ["Tipo de proyecto", d?.tipoproyecto_sol?.label ?? null],
    ["Número de viviendas", txt(d?.nroviviendas_sol)],
    ["Número de predios", txt(d?.nropredios_sol)],
    ["Área (m²)", txt(d?.area_sol)],
    ["Descripción del sitio", txt(d?.descripsitio_sol)],
  ];

  const datosContacto: [string, string | null][] = [
    ["Correo", txt(d?.correo_sol) ?? base.correo],
    ["Teléfono", txt(d?.telefono_sol)],
    ["Representante legal", base.representanteLegal],
    ["Identificación del representante", base.idRepresentante],
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
        {base.lat != null && base.lon != null && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <MapPin className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            <span>
              {base.lat.toFixed(5)}, {base.lon.toFixed(5)}{" "}
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
          <p className="mt-3 text-sm text-stone-500">No fue posible consultar los documentos en SINCA 1.0 en este momento. Intente más tarde.</p>
        ) : documentos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Esta solicitud no tiene documentos registrados en SINCA 1.0.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {documentos.map((doc, i) => {
              const archivo = nombreArchivo(doc.caminopdf_edc);
              return (
                <li key={i} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-stone-800">
                      {doc.documentos_cdmb?.nombre_dcc ?? doc.documentos_cdmb?.tipodoc_dcc?.label ?? "Documento"}
                    </p>
                    <span className="text-xs text-stone-400">
                      {doc.documentos_cdmb?.tipodoc_dcc?.label ?? "—"}
                      {doc.nrodocumento_edc ? ` · N.º ${doc.nrodocumento_edc}` : ""}
                    </span>
                  </div>
                  {doc.referencia_edc && <p className="mt-1 text-sm text-stone-600">{doc.referencia_edc}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-500">
                    {fecha(doc.fechaemision_edc) && <span>Emisión: {fecha(doc.fechaemision_edc)}</span>}
                    {fecha(doc.fechavigencia_edc) && <span>Vigencia: {fecha(doc.fechavigencia_edc)}</span>}
                    {fecha(doc.fechanotificacion_edc) && <span>Notificación: {fecha(doc.fechanotificacion_edc)}</span>}
                    {doc.foliosdoc_edc != null && <span>{doc.foliosdoc_edc} folios</span>}
                  </div>
                  {archivo && (
                    <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                      Archivo en el sistema documental de SINCA 1.0: <span className="font-mono">{archivo}</span>. La
                      descarga del PDF aún no está disponible en esta consulta.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Campos titulo="Datos de la solicitud" icon={ClipboardList} campos={datosSolicitud} />
      <Campos titulo="Ubicación y predio" icon={MapPin} campos={datosUbicacion} />
      <Campos titulo="Contacto" icon={User} campos={datosContacto} />

      {nombreInteresado && (
        <Campos
          titulo="Interesado"
          icon={User}
          campos={[
            ["Nombre / razón social", nombreInteresado],
            ["Identificación", nitInteresado],
            ["Correo", txt(interesado?.correo_nit)],
            ["Celular", txt(interesado?.celular_nit)],
            ["Dirección", txt(interesado?.direcc_nit)],
            ["Naturaleza jurídica", txt((interesado?.natur_jurid_nit as { label?: string } | undefined)?.label)],
          ]}
        />
      )}

      {esAdmin && d && (
        <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-stone-500">Datos técnicos (solo administradores)</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">{JSON.stringify(d, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
