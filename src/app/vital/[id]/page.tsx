import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  User,
  Building2,
  IdCard,
  Mail,
  Phone,
  MapPin,
  ClipboardList,
  FileText,
  Download,
  CalendarClock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import { nombreTramiteVital, urlVitalPublico } from "@/lib/vital";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { formatearFechaLarga, formatearFechaHora } from "@/lib/fecha";

const VACIOS = new Set(["", "null", "undefined", "n/a", "no se n", "no se", "-", "--"]);
const txt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("label" in o) return txt(o.label);
    if ("nombre" in o) return txt(o.nombre);
    if ("descripcion" in o) return txt(o.descripcion);
    if ("value" in o) return txt(o.value);
    return null;
  }
  const s = String(v).trim();
  return VACIOS.has(s.toLowerCase()) ? null : s;
};

// Convierte "primerNombre" / "numero_identificacion" en "Primer nombre"
const humanizar = (clave: string): string => {
  const conEspacios = clave
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
};

// Etiquetas amables para los campos que VITAL manda del solicitante
const ETIQUETAS_SOLICITANTE: Record<string, string> = {
  tipoPersona: "Tipo de persona",
  tipoIdentificacion: "Tipo de identificación",
  numeroIdentificacion: "Número de identificación",
  identificacion: "Identificación",
  razonSocial: "Razón social",
  primerNombre: "Primer nombre",
  segundoNombre: "Segundo nombre",
  primerApellido: "Primer apellido",
  segundoApellido: "Segundo apellido",
  nombreCompleto: "Nombre completo",
  correoElectronico: "Correo electrónico",
  correo: "Correo electrónico",
  email: "Correo electrónico",
  telefonoContacto: "Teléfono de contacto",
  telefono: "Teléfono",
  celular: "Celular",
  direccionResidencia: "Dirección de residencia",
  direccion: "Dirección",
  municipioResidencia: "Municipio",
  municipio: "Municipio",
  departamentoResidencia: "Departamento",
  departamento: "Departamento",
  pais: "País",
  representanteLegal: "Representante legal",
};

function Campo({ k, v, ancho }: { k: string; v: string | null; ancho?: boolean }) {
  if (!v) return null;
  return (
    <div className={`min-w-0 ${ancho ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <dt className="text-[11px] leading-tight text-stone-400">{k}</dt>
      <dd className={`text-sm text-stone-800 ${ancho ? "break-words" : "truncate"}`} title={v}>
        {v}
      </dd>
    </div>
  );
}

function Tarjeta({
  icon: Icon,
  titulo,
  children,
  extra,
}: {
  icon: typeof MapPin;
  titulo: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
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

function ChipDato({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1 text-xs text-stone-600">
      <Icon className="h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden />
      {children}
    </span>
  );
}

type Interesado = Record<string, unknown>;

function nombreInteresado(i: Interesado): string | null {
  return (
    txt(i.razonSocial) ||
    [i.primerNombre, i.segundoNombre, i.primerApellido, i.segundoApellido].map(txt).filter(Boolean).join(" ").trim() ||
    txt(i.nombreCompleto) ||
    null
  );
}

function esPersonaJuridica(i: Interesado): boolean {
  const tp = (txt(i.tipoPersona) ?? "").toLowerCase();
  return tp.includes("jur") || Boolean(txt(i.razonSocial));
}

// VITAL suele repetir el mismo interesado 2+ veces dentro de `solicitanteRaw` (confirmado en
// datos reales) — sin este filtro la tarjeta de Solicitante mostraba la misma persona duplicada.
function dedupeInteresados(lista: Interesado[]): Interesado[] {
  const vistos = new Set<string>();
  const resultado: Interesado[] = [];
  for (const i of lista) {
    const clave = txt(i.numeroIdentificacion) ?? txt(i.identificacion) ?? JSON.stringify(i);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(i);
  }
  return resultado;
}

function DatosInteresado({ i }: { i: Interesado }) {
  const nombre = nombreInteresado(i);
  const id = txt(i.numeroIdentificacion) ?? txt(i.identificacion);
  const tipoId = txt(i.tipoIdentificacion);
  const correo = txt(i.correoElectronico) ?? txt(i.correo) ?? txt(i.email);
  const tel = txt(i.telefonoContacto) ?? txt(i.telefono) ?? txt(i.celular);
  const direccion = txt(i.direccionResidencia) ?? txt(i.direccion);
  const municipio = txt(i.municipioResidencia) ?? txt(i.municipio);
  const depto = txt(i.departamentoResidencia) ?? txt(i.departamento);
  const lugar = [municipio, depto].filter(Boolean).join(", ");

  // Campos que ya mostramos arriba; el resto se lista genérico
  const yaMostrados = new Set([
    "razonSocial", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
    "nombreCompleto", "numeroIdentificacion", "identificacion", "tipoIdentificacion",
    "tipoPersona", "correoElectronico", "correo", "email", "telefonoContacto", "telefono",
    "celular", "direccionResidencia", "direccion", "municipioResidencia", "municipio",
    "departamentoResidencia", "departamento",
  ]);
  const otros = Object.entries(i)
    .filter(([k, v]) => !yaMostrados.has(k) && txt(v) !== null)
    .map(([k, v]) => [ETIQUETAS_SOLICITANTE[k] ?? humanizar(k), txt(v)!] as const);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cdmb-50 text-cdmb-700">
          {esPersonaJuridica(i) ? <Building2 className="h-4 w-4" aria-hidden /> : <User className="h-4 w-4" aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900" title={nombre ?? undefined}>
            {nombre ?? txt(i.tipoPersona) ?? "Solicitante sin nombre reportado"}
          </p>
          {/* Solo como subtítulo si no es ya lo que se muestra arriba (si no hay nombre, la línea
              principal cae en tipoPersona y repetirlo abajo mostraría el mismo texto dos veces). */}
          {nombre && txt(i.tipoPersona) && <p className="text-xs text-stone-400">{txt(i.tipoPersona)}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {id && (
          <ChipDato icon={IdCard}>
            {tipoId ? `${tipoId} ` : ""}
            {id}
          </ChipDato>
        )}
        {correo && <ChipDato icon={Mail}>{correo}</ChipDato>}
        {tel && <ChipDato icon={Phone}>{tel}</ChipDato>}
        {(direccion || lugar) && (
          <ChipDato icon={MapPin}>{[direccion, lugar].filter(Boolean).join(" · ")}</ChipDato>
        )}
      </div>

      {otros.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-stone-100 pt-3 sm:grid-cols-3">
          {otros.map(([k, v]) => (
            <Campo key={k} k={k} v={v} />
          ))}
        </dl>
      )}
    </div>
  );
}

function CamposFormulario({ datos }: { datos: unknown }) {
  if (!datos || typeof datos !== "object") {
    return <p className="text-sm text-stone-400">El trámite no trae campos de formulario.</p>;
  }
  const entradas = Object.entries(datos as Record<string, unknown>)
    .map(([k, v]) => {
      const valor = txt(v) ?? (v && typeof v === "object" ? JSON.stringify(v) : null);
      return [humanizar(k), valor] as const;
    })
    .filter(([, v]) => v !== null);

  if (entradas.length === 0) {
    return <p className="text-sm text-stone-400">El trámite no trae campos de formulario.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {entradas.map(([k, v]) => (
        <Campo key={k} k={k} v={v} ancho={(v?.length ?? 0) > 60} />
      ))}
    </dl>
  );
}

export default async function VitalDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const session = await getSession();
  let esAdmin = false;
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "VITAL_BASE")) redirect("/");
    esAdmin = permisos.esAdmin;
  }

  const solicitud = await db.solicitudVital.findUnique({
    where: { id },
    include: { documentos: { orderBy: { createdAt: "desc" } } },
  });
  if (!solicitud) notFound();

  const interesados: Interesado[] = dedupeInteresados(
    Array.isArray(solicitud.solicitanteRaw)
      ? (solicitud.solicitanteRaw as Interesado[])
      : solicitud.solicitanteRaw && typeof solicitud.solicitanteRaw === "object"
        ? [solicitud.solicitanteRaw as Interesado]
        : []
  );

  const fechaRad = solicitud.fechaRadicacion ? formatearFechaLarga(solicitud.fechaRadicacion) : null;

  // VITAL puede reportar más documentos (wsDocumentos) de los que quedaron guardados: el servicio
  // de descarga de VITAL viene fallando por permisos (ver nota en sincronizarSolicitud/vital.ts) —
  // mejor avisarlo que mostrar "sin documentos" como si el trámite no tuviera ninguno adjunto.
  const documentosFaltantes = Math.max(0, (solicitud.documentosReportados ?? 0) - solicitud.documentos.length);

  return (
    <div className="space-y-4">
      <Link href="/vital" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a las solicitudes
      </Link>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {/* Cabecera */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">Solicitud VITAL {solicitud.idVital}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cdmb-50 px-2.5 py-0.5 text-xs font-medium text-cdmb-800">
              {nombreTramiteVital(solicitud.idTramiteVital)}
            </span>
            <a
              href={urlVitalPublico(solicitud.idVital)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
              title="Abrir esta solicitud en el buscador público de VITAL (minambiente.gov.co)"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Ver en VITAL
            </a>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          <Campo k="ID VITAL" v={solicitud.idVital} />
          <Campo k="Fecha de radicación" v={fechaRad} />
          <Campo k="Actividad" v={txt(solicitud.nombreActividad)} />
          <Campo
            k="ID trámite en la autoridad"
            v={solicitud.idTramiteAutoridad != null ? String(solicitud.idTramiteAutoridad) : null}
          />
        </dl>
      </div>

      {/* Solicitante(s) */}
      <Tarjeta
        icon={interesados.length > 0 && esPersonaJuridica(interesados[0]) ? Building2 : User}
        titulo={interesados.length > 1 ? `Solicitantes (${interesados.length})` : "Solicitante"}
      >
        {interesados.length === 0 ? (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Campo k="Nombre / razón social" v={txt(solicitud.solicitanteNombre)} />
            <Campo k="Identificación" v={txt(solicitud.solicitanteIdentificacion)} />
            <Campo k="Correo electrónico" v={txt(solicitud.solicitanteCorreo)} />
          </dl>
        ) : (
          <div className="space-y-5">
            {interesados.map((i, idx) => (
              <div key={idx} className={idx > 0 ? "border-t border-stone-100 pt-4" : ""}>
                <DatosInteresado i={i} />
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      {/* Campos del formulario */}
      <Tarjeta icon={ClipboardList} titulo="Datos del formulario del trámite">
        <CamposFormulario datos={solicitud.camposTramite} />
      </Tarjeta>

      {/* Documentos */}
      <Tarjeta icon={FileText} titulo={`Documentos adjuntos (${solicitud.documentos.length})`}>
        {documentosFaltantes > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <p>
              VITAL reporta {documentosFaltantes} documento{documentosFaltantes === 1 ? "" : "s"} adjunto{documentosFaltantes === 1 ? "" : "s"} más
              que no {documentosFaltantes === 1 ? "se pudo" : "se pudieron"} descargar — es un problema de permisos del servicio de VITAL, no de
              esta plataforma. Informe al área de sistemas.
            </p>
          </div>
        )}

        {solicitud.enlaceDocumentosSilpa && (
          <a
            href={solicitud.enlaceDocumentosSilpa}
            target="_blank"
            rel="noreferrer"
            className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-cdmb-50 px-3 py-1.5 text-sm font-medium text-cdmb-800 hover:bg-cdmb-100"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Ver estado y adjuntos en VITAL (portal de la autoridad ambiental)
          </a>
        )}

        {esAdmin && (
          <details className="mb-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <summary className="cursor-pointer font-medium text-stone-700">
              {solicitud.enlaceDocumentosSilpa ? "Editar" : "Pegar"} el enlace de VITAL con los adjuntos (ADMIN)
            </summary>
            <p className="mt-2">
              En VITAL, abra este trámite y copie la URL de la ficha &ldquo;¿En qué va mi trámite?&rdquo; que
              incluye <code>TarSolId</code> y <code>Solicitante</code> — no se puede armar sola porque esos dos
              ids no vienen en la sincronización por X-Road. No exige iniciar sesión.
            </p>
            <form action={`/api/vital/${solicitud.id}/enlace-documentos`} method="post" className="mt-2 flex flex-wrap items-center gap-2">
              <input
                name="enlace"
                type="url"
                defaultValue={solicitud.enlaceDocumentosSilpa ?? ""}
                placeholder="https://vital.minambiente.gov.co/SILPA_UT_PRE/ReporteTramite/ReportetramiteCPDetalle.aspx?..."
                className="w-full min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
              <button
                type="submit"
                className="flex-none rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700"
              >
                Guardar
              </button>
            </form>
          </details>
        )}

        {solicitud.documentos.length === 0 && documentosFaltantes === 0 ? (
          <p className="text-sm text-stone-400">La solicitud no trae documentos adjuntos.</p>
        ) : solicitud.documentos.length > 0 ? (
          <ul className="space-y-2">
            {solicitud.documentos.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                  <span className="truncate text-sm text-stone-800" title={doc.nombre}>
                    {doc.nombre}
                  </span>
                </span>
                <a
                  href={`/api/vital-documentos/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-none items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Abrir
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </Tarjeta>

      <p className="flex items-center gap-1.5 text-xs text-stone-400">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        Última sincronización con VITAL: {formatearFechaHora(solicitud.ultimaSincronizacion)}
      </p>
    </div>
  );
}
