import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, MapPin, FileText, Building2, ClipboardList, Download, ScrollText } from "lucide-react";
import { getSession } from "@/lib/auth";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { getHistoricoResolucion } from "@/lib/sinca-data";
import { sincaConfigurado, obtenerResolucionDetalle, type SincaResolucionDetalleApi, type SincaNit } from "@/lib/sinca";

function fecha(valor: Date | string | null | undefined) {
  if (!valor) return null;
  const d = typeof valor === "string" ? new Date(valor.includes(" ") ? valor.replace(" ", "T") : valor) : valor;
  if (Number.isNaN(d.getTime())) return null;
  const a = d.getUTCFullYear();
  if (a < 1980 || a > new Date().getUTCFullYear() + 6) return null;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
const VACIOS = new Set(["", "null", "no se n", "no se", "n/a"]);
const txt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return VACIOS.has(s.toLowerCase()) ? null : s;
};
const etq = (v: unknown): string | null => (v && typeof v === "object" && "label" in v ? txt((v as { label: unknown }).label) : txt(v));
const archivoDe = (c: string | null | undefined) => (c ? c.split(/[\\/]/).pop() || c : null);

function Campo({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-stone-400">{k}</dt>
      <dd className="truncate text-sm text-stone-800" title={v}>
        {v}
      </dd>
    </div>
  );
}

function Tarjeta({ icon: Icon, titulo, children, extra }: { icon: typeof MapPin; titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
          <Icon className="h-3.5 w-3.5 text-cdmb-600" aria-hidden />
          {titulo}
        </h3>
        {extra}
      </div>
      {children}
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
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "SINCA_BASE")) redirect("/");
  }
  const esAdmin = session?.rol === "ADMIN";

  let d: SincaResolucionDetalleApi | null = null;
  let errorDetalle = false;
  try {
    d = await obtenerResolucionDetalle(nroSolicitud);
  } catch {
    errorDetalle = true;
  }

  const docs = d?.emision_documentos ?? [];
  const resDoc = docs.find((x) => x.documentos_cdmb?.tipodoc_dcc?.value === "R");
  const fechaResolucion = fecha(base.fechaResolucion) ?? fecha(resDoc?.fechaemision_edc) ?? fecha(resDoc?.fechavigencia_edc);

  const nit = (d?.interesado?.[0]?.nit ?? undefined) as SincaNit | undefined;
  const nombreInt =
    txt(nit?.razon_soc_nit) ||
    [nit?.primer_nom_nit, nit?.segundo_nom_nit, nit?.primer_ape_nit, nit?.segundo_ape_nit].filter(Boolean).join(" ") ||
    txt(nit?.nombre_nit) ||
    base.representanteLegal;
  const nitId = nit?.numero_nit ? `${nit.numero_nit}${nit.digito_nit != null ? `-${nit.digito_nit}` : ""}` : base.idRepresentante;

  return (
    <div className="space-y-4">
      <Link href="/historico/solicitudes" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al listado
      </Link>

      {/* Cabecera compacta */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">Resolución {base.numeroResolucion ?? "—"}</h2>
          <span className="rounded-full bg-cdmb-50 px-2.5 py-0.5 text-xs font-medium text-cdmb-800">{base.estado ?? "—"}</span>
        </div>
        <p className="mt-1.5 text-sm text-stone-700">{base.proyecto || "Sin descripción del proyecto."}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          <Campo k="N.º de solicitud" v={String(base.nroSolicitud)} />
          <Campo k="Fecha de resolución" v={fechaResolucion} />
          <Campo k="Expediente" v={base.expediente} />
          <Campo k="Tipo de trámite" v={base.tipoSolicitud} />
          <Campo k="Tipo (SINCA)" v={txt(d?.tipo_solicitud?.tipotramite_tps)} />
          <Campo k="Tiempo objetivo" v={d?.tipo_solicitud?.tiempo_dias_tps ? `${d.tipo_solicitud.tiempo_dias_tps} días` : null} />
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta icon={ClipboardList} titulo="Datos de la solicitud">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Campo k="Origen" v={etq(d?.origen_sol) ?? base.origen} />
            <Campo k="N.º de origen (radicado)" v={txt(d?.nroorigen_sol)} />
            <Campo k="Año de origen" v={txt(d?.anoorigen_sol)} />
            <Campo k="Fecha de recibido" v={fecha(base.fechaRecibido) ?? fecha(d?.fecharecibido_sol)} />
            <Campo k="Fecha de registro" v={fecha(d?.feregistro_sol)} />
            <Campo k="Modalidad" v={etq(d?.indtiposol_sol) ?? base.indTipoSolicitud} />
            <Campo k="¿Requiere permiso?" v={etq(d?.requierepermiso_sol)} />
            <Campo k="Licencia única" v={etq(d?.licenciaunica_sol)} />
            <Campo k="N.º de título minero" v={txt(d?.nrotitulomin_tmi)} />
            <Campo k="Usuario que creó" v={txt(d?.usuariocrea_sol)} />
          </dl>
        </Tarjeta>

        <Tarjeta icon={MapPin} titulo="Ubicación y predio">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Campo k="Departamento" v={txt(d?.municipios?.departamentos?.nombre_dpt) ?? base.departamento} />
            <Campo k="Municipio" v={txt(d?.municipios?.nombre_mun) ?? base.municipio} />
            <Campo k="Centro poblado" v={etq(d?.tipocenpoblado_sol)} />
            <Campo k="Vereda" v={txt(d?.vereda)} />
            <Campo k="Barrio / sector" v={txt(d?.barrio) ?? txt(base.barrio)} />
            <Campo k="Dirección" v={txt(d?.direccion_sol)} />
            <Campo k="Clase de suelo" v={etq(d?.clasesuelo_sol)} />
            <Campo k="Uso del suelo" v={etq(d?.usosuelo_sol)} />
            <Campo k="Tipo de proyecto" v={etq(d?.tipoproyecto_sol)} />
            <Campo k="N.º de viviendas" v={txt(d?.nroviviendas_sol)} />
            <Campo k="N.º de predios" v={txt(d?.nropredios_sol)} />
            <Campo k="Área (m²)" v={txt(d?.area_sol)} />
          </dl>
          {base.lat != null && base.lon != null && (
            <p className="mt-3 flex items-center gap-1.5 border-t border-stone-100 pt-2 text-xs text-stone-500">
              <MapPin className="h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden />
              {base.lat.toFixed(5)}, {base.lon.toFixed(5)} ·{" "}
              <a href={`https://www.openstreetmap.org/?mlat=${base.lat}&mlon=${base.lon}#map=15/${base.lat}/${base.lon}`} target="_blank" rel="noopener noreferrer" className="text-cdmb-700 underline">
                mapa
              </a>
            </p>
          )}
        </Tarjeta>
      </div>

      {/* Documentos */}
      <Tarjeta icon={FileText} titulo="Documentos de la resolución">
        {errorDetalle ? (
          <p className="text-sm text-stone-500">No fue posible consultar los documentos en SINCA 1.0 en este momento.</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-stone-500">Sin documentos registrados en SINCA 1.0.</p>
        ) : (
          <ul className="space-y-3">
            {docs.map((doc, i) => {
              const arch = archivoDe(doc.caminopdf_edc);
              return (
                <li key={i} className="rounded-lg border border-stone-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-stone-800">{doc.documentos_cdmb?.nombre_dcc ?? doc.documentos_cdmb?.tipodoc_dcc?.label ?? "Documento"}</p>
                    <span className="text-xs text-stone-400">
                      {doc.documentos_cdmb?.tipodoc_dcc?.label ?? "—"}
                      {doc.nrodocumento_edc ? ` · N.º ${doc.nrodocumento_edc}` : ""}
                    </span>
                  </div>
                  {doc.referencia_edc && <p className="mt-1 text-sm text-stone-600">{doc.referencia_edc}</p>}
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                    <Campo k="Emisión" v={fecha(doc.fechaemision_edc)} />
                    <Campo k="Vigencia" v={fecha(doc.fechavigencia_edc)} />
                    <Campo k="Notificación" v={fecha(doc.fechanotificacion_edc)} />
                    <Campo k="Folios" v={txt(doc.foliosdoc_edc)} />
                    <Campo k="Definitivo" v={etq(doc.inddefinitivo_edc)} />
                    <Campo k="Requiere notificación" v={etq(doc.documentos_cdmb?.requierenotif_dcc)} />
                    <Campo k="Es motivado" v={etq(doc.documentos_cdmb?.esmotivado_dcc)} />
                    <Campo k="Ubicación del PDF" v={etq(doc.tipoubicacionpdf_edc)} />
                  </dl>
                  {arch && (
                    <div className="mt-2.5">
                      <a
                        href={`/api/historico/documento/${base.nroSolicitud}/${i}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Ver / descargar {arch.split(".").pop()?.toUpperCase()}
                      </a>
                      <span className="ml-2 text-xs text-stone-400">
                        {arch} — se obtiene del servidor documental de la CDMB; si no abre, ese servidor no está disponible desde aquí.
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      {/* Interesado */}
      {nombreInt && (
        <Tarjeta icon={Building2} titulo="Interesado">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            <Campo k="Nombre / razón social" v={nombreInt} />
            <Campo k="Identificación" v={nitId} />
            <Campo k="Tipo de ID" v={etq(nit?.tipo_nit)} />
            <Campo k="Tipo de persona" v={etq(nit?.natur_jurid_nit)} />
            <Campo k="Régimen" v={etq(nit?.regimen_nit)} />
            <Campo k="Clase" v={txt(nit?.clase_nit)} />
            <Campo k="Gran contribuyente" v={etq(nit?.gcontri_nit)} />
            <Campo k="Autorretenedor" v={etq(nit?.autoret_nit)} />
            <Campo k="Departamento" v={txt(nit?.municipios?.departamentos?.nombre_dpt)} />
            <Campo k="Municipio" v={txt(nit?.municipios?.nombre_mun)} />
            <Campo k="Dpto. domicilio" v={txt(nit?.municipios_dom?.departamentos?.nombre_dpt)} />
            <Campo k="Mun. domicilio" v={txt(nit?.municipios_dom?.nombre_mun)} />
            <Campo k="Dirección" v={txt(nit?.direcc_nit) ?? txt(d?.direccion_sol)} />
            <Campo k="Teléfono" v={txt(nit?.telef_nit) ?? txt(d?.telefono_sol)} />
            <Campo k="Celular" v={txt(nit?.celular_nit)} />
            <Campo k="Correo" v={txt(nit?.correo_nit) ?? base.correo} />
            <Campo k="Fecha de actualización" v={fecha(nit?.fechaact_nit)} />
            <Campo k="Usuario que actualizó" v={txt(nit?.usuarioact_nit)} />
          </dl>
        </Tarjeta>
      )}

      {/* Descripción / observación */}
      {(txt(d?.descripsitio_sol) || txt(d?.observacion_sol)) && (
        <Tarjeta icon={ScrollText} titulo="Descripción y observaciones">
          {txt(d?.descripsitio_sol) && (
            <p className="text-sm text-stone-700">
              <span className="text-[11px] uppercase tracking-wide text-stone-400">Descripción del sitio · </span>
              {d?.descripsitio_sol}
            </p>
          )}
          {txt(d?.observacion_sol) && (
            <p className="mt-2 text-sm text-stone-700">
              <span className="text-[11px] uppercase tracking-wide text-stone-400">Observación · </span>
              {d?.observacion_sol}
            </p>
          )}
        </Tarjeta>
      )}

      {esAdmin && d && (
        <details className="rounded-xl border border-stone-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-stone-500">Datos técnicos (solo administradores)</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-stone-900 p-3 text-xs text-stone-100">{JSON.stringify(d, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
