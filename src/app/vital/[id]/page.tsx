import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
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
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import { completarAnexosVital, completarDatosVital, nombreTramiteVital, urlVitalPublico } from "@/lib/vital";
import { ETIQUETA_ORIGEN_COORDENADA, puntoDesdeCampos } from "@/lib/coordenadas-texto";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeConsultarVital, puedeConvertirSolicitudVital } from "@/lib/permisos";
import { formatearFechaLarga, formatearFechaHora } from "@/lib/fecha";
import { BandaTablero } from "@/components/tablero";
import { GestionSolicitudVital, type TramiteOpcion } from "@/components/vital/GestionSolicitudVital";
import { codigoFlujoSugerido, codigoTramiteSugerido, prellenadoDesdeVital } from "@/lib/vital-conversion";
import { entradasCatalogo } from "@/lib/opciones-catalogo";
import { ArrowRightCircle } from "lucide-react";
import { aGms } from "@/lib/coordenadas-geograficas";

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

const humanizar = (clave: string): string => {
  const conEspacios = clave
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
};

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
    <section className="rounded-2xl border border-stone-200 bg-white shadow-soft p-4">
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
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-stone-50 px-2.5 py-1 text-xs text-stone-600">
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
        <span className="flex h-9 w-9 flex-none items-center justify-center text-cdmb-700">
          {esPersonaJuridica(i) ? <Building2 className="h-4 w-4" aria-hidden /> : <User className="h-4 w-4" aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900" title={nombre ?? undefined}>
            {nombre ?? txt(i.tipoPersona) ?? "Solicitante sin nombre reportado"}
          </p>
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
    return <p className="text-sm text-stone-400">VITAL no entregó los datos del formulario de esta solicitud.</p>;
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

type AnexoGuardado = { id: string; nombre: string };

/**
 * Acceso directo a la solicitud en el portal de VITAL, junto a la lista de anexos:
 * allí se pueden ver y descargar los anexos aunque la descarga desde el SIC no
 * esté disponible. Es la misma dirección del botón «Ver en VITAL» de la ficha.
 */
function BotonAnexosEnVital({ idVital }: { idVital: string }) {
  return (
    <a
      href={urlVitalPublico(idVital)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      title="Ver y descargar los anexos de esta solicitud en el portal de VITAL (minambiente.gov.co)"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      Ver anexos en VITAL
    </a>
  );
}

/**
 * Lista de anexos. Va aparte (en <Suspense>) porque, si la solicitud aún no tiene
 * la lista guardada, se consulta VITAL en vivo y eso puede tardar: el resto de la
 * ficha se muestra de una vez.
 */
async function AnexosVital({ solicitudId, idVital, reportados: reportadosGuardados, guardados }: { solicitudId: string; idVital: string; reportados: number | null; guardados: AnexoGuardado[] }) {
  let reportados = reportadosGuardados;
  let documentos = guardados;
  let fallo: string | null = null;
  // Siempre se pide la lista actual a VITAL: puede agregar anexos (acuse, paquete) después
  // de la primera sincronización. Si no responde, se muestra lo guardado.
  {
    // VITAL pasa por el puente y X-Road: obtener los tokens y la lista puede tardar.
    // La consulta sigue aunque se agote la espera y deja la lista guardada.
    const r = await Promise.race([
      completarAnexosVital(solicitudId),
      new Promise<{ ok: false; motivo: string }>((res) =>
        setTimeout(() => res({ ok: false, motivo: "VITAL no respondió a tiempo; la consulta sigue en segundo plano." }), 45_000),
      ),
    ]).catch((err) => ({ ok: false as const, motivo: err instanceof Error ? err.message : String(err) }));
    if (r.ok) {
      documentos = await db.solicitudVitalDocumento.findMany({ where: { solicitudId }, orderBy: { createdAt: "desc" }, select: { id: true, nombre: true } });
      reportados = r.total;
    } else {
      fallo = r.motivo;
    }
  }
  const faltan = Math.max(0, (reportados ?? 0) - documentos.length);

  return (
    <Tarjeta
      icon={FileText}
      titulo={`Documentos adjuntos (${Math.max(documentos.length, reportados ?? 0)})`}
      extra={documentos.length > 0 || faltan > 0 || fallo ? <BotonAnexosEnVital idVital={idVital} /> : undefined}
    >
      {fallo && documentos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-300 px-3 py-2 text-sm text-amber-800">
          <p>No se pudo mostrar la lista de anexos.</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <a href={`/vital/${solicitudId}`} className="font-medium text-cdmb-700 hover:underline">
              Volver a intentar
            </a>
            <a href={urlVitalPublico(idVital)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-cdmb-700 hover:underline">
              Ver la solicitud en VITAL <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </p>
        </div>
      ) : documentos.length === 0 && faltan === 0 ? (
        <p className="text-sm text-stone-400">La solicitud no trae documentos adjuntos.</p>
      ) : (
        <ul className="space-y-2">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                <a
                  href={`/api/vital-documentos/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-stone-800 hover:text-cdmb-700 hover:underline"
                  title={doc.nombre}
                >
                  {doc.nombre}
                </a>
              </span>
              <a
                href={`/api/vital-documentos/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                title={`Abrir ${doc.nombre}`}
                className="inline-flex flex-none items-center gap-1.5 rounded-md border border-menu-500 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Abrir
              </a>
            </li>
          ))}
          {fallo && faltan > 0 ? (
            <li className="rounded-lg border border-dashed border-amber-300 px-3 py-2 text-sm text-amber-800">
              {faltan === 1 ? "No se pudo mostrar 1 anexo más." : `No se pudieron mostrar ${faltan} anexos más.`}{" "}
              <a href={`/vital/${solicitudId}`} className="font-medium text-cdmb-700 hover:underline">Volver a intentar</a>
              {" · "}
              <a href={urlVitalPublico(idVital)} target="_blank" rel="noreferrer" className="font-medium text-cdmb-700 hover:underline">Ver la solicitud en VITAL</a>
            </li>
          ) : null}
        </ul>
      )}
    </Tarjeta>
  );
}

export default async function VitalDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  if (permisos && !puedeConsultarVital(permisos)) redirect("/");

  const solicitud = await db.solicitudVital.findUnique({
    where: { id },
    include: {
      documentos: { orderBy: { createdAt: "desc" } },
      expediente: { select: { id: true, numero: true } },
    },
  });
  if (!solicitud) notFound();

  // Si la solicitud quedó sin formulario, sin solicitante o sin fecha (VITAL falló al
  // sincronizarla), se vuelven a pedir esos datos antes de mostrar la ficha.
  if (solicitud.camposTramite == null || solicitud.solicitanteRaw == null || solicitud.fechaRadicacion == null) {
    const r = await Promise.race([
      completarDatosVital(solicitud.id).catch(() => ({ ok: false })),
      new Promise<{ ok: false }>((res) => setTimeout(() => res({ ok: false }), 12_000)),
    ]);
    if (r.ok || solicitud.fechaRadicacion == null) {
      const actual = await db.solicitudVital.findUnique({
        where: { id },
        select: { camposTramite: true, solicitanteRaw: true, solicitanteNombre: true, solicitanteIdentificacion: true, solicitanteCorreo: true, fechaRadicacion: true },
      });
      if (actual) Object.assign(solicitud, actual);
    }
  }
  const punto = puntoDesdeCampos(solicitud.camposTramite);

  const interesados: Interesado[] = dedupeInteresados(
    Array.isArray(solicitud.solicitanteRaw)
      ? (solicitud.solicitanteRaw as Interesado[])
      : solicitud.solicitanteRaw && typeof solicitud.solicitanteRaw === "object"
        ? [solicitud.solicitanteRaw as Interesado]
        : []
  );

  const fechaRad = solicitud.fechaRadicacion ? formatearFechaLarga(solicitud.fechaRadicacion) : "Sin fecha en VITAL";

  // «Convertir en trámite»: solo administrador y Subdirector(a) SEYCA. Mismas entradas, grupos y
  // conteos que el catálogo de trámites (un trámite con varios procedimientos inscritos cada uno en
  // el SUIT sale una vez por procedimiento). Los que no tienen procedimiento en SIC no se pueden elegir.
  let opcionesTramite: TramiteOpcion[] = [];
  let claveSugerida: string | null = null;
  if (permisos && puedeConvertirSolicitudVital(permisos)) {
    const entradas = await entradasCatalogo((slug, flujo) => (flujo ? `/tramites/${slug}/nuevo?flujo=${flujo}` : `/tramites/${slug}/nuevo`));
    const codigoSugerido = codigoTramiteSugerido(solicitud.idTramiteVital);
    const flujoSugerido = codigoFlujoSugerido(solicitud.idTramiteVital, prellenadoDesdeVital(solicitud).claseSolicitud);
    const delSugerido = entradas.filter((e) => e.radicable && e.codigo === codigoSugerido);
    claveSugerida = (delSugerido.find((e) => e.flujo && e.flujo === flujoSugerido) ?? delSugerido[0])?.clave ?? null;
    opcionesTramite = entradas.map((e) => ({ clave: e.clave, href: e.href, nombre: e.nombre, codigo: e.codigo, suits: e.suits, enSuit: e.enSuit, radicable: e.radicable }));
  }
  const gestorNombre = solicitud.gestionadaPorId
    ? (await db.usuario.findUnique({ where: { id: solicitud.gestionadaPorId }, select: { nombre: true } }))?.nombre ?? null
    : null;
  const gestionadaTexto = solicitud.gestionadaEn
    ? `${formatearFechaHora(solicitud.gestionadaEn)}${gestorNombre ? ` · ${gestorNombre}` : ""}`
    : null;


  return (
    <div className="space-y-4">
      <Link href="/vital" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a las solicitudes
      </Link>

      <BandaTablero>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-stone-900">Solicitud VITAL {solicitud.idVital}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-cdmb-50 px-2.5 py-0.5 text-xs font-medium text-cdmb-800">
              {nombreTramiteVital(solicitud.idTramiteVital)}
            </span>
            <a
              href={urlVitalPublico(solicitud.idVital)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
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
        {punto && (
          <p className="mt-3 text-xs text-stone-600">
            <span className="font-medium text-stone-500">Ubicación ({ETIQUETA_ORIGEN_COORDENADA[punto.origen]}): </span>
            <span className="font-mono">
              {aGms(punto.lat, true)}, {aGms(punto.lon, false)}
            </span>{" "}
            <span className="text-stone-400">
              ({punto.lat.toFixed(6)}, {punto.lon.toFixed(6)})
            </span>{" "}
            <Link href={`/visor-tramites?capa=vital&punto=${encodeURIComponent(solicitud.idVital)}`} className="font-medium text-cdmb-700 hover:underline">
              Ver en el visor de trámites →
            </Link>
          </p>
        )}
      </BandaTablero>

      <Tarjeta icon={ArrowRightCircle} titulo="Gestión en SIC">
        <GestionSolicitudVital
          solicitudId={solicitud.id}
          gestion={solicitud.gestion}
          expediente={solicitud.expediente}
          motivoDescarte={solicitud.motivoDescarte}
          gestionadaTexto={gestionadaTexto}
          tramites={opcionesTramite}
          claveSugerida={claveSugerida}
        />
      </Tarjeta>

      <Tarjeta
        icon={interesados.length > 0 && esPersonaJuridica(interesados[0]) ? Building2 : User}
        titulo={interesados.length > 1 ? `Solicitantes (${interesados.length})` : "Solicitante"}
      >
        {interesados.length === 0 && !txt(solicitud.solicitanteNombre) && !txt(solicitud.solicitanteIdentificacion) && !txt(solicitud.solicitanteCorreo) ? (
          <p className="text-sm text-stone-400">VITAL no entregó los datos del solicitante de esta solicitud.</p>
        ) : interesados.length === 0 ? (
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

      <Tarjeta icon={ClipboardList} titulo="Datos del formulario del trámite">
        <CamposFormulario datos={solicitud.camposTramite} />
      </Tarjeta>

      <Suspense
        fallback={
          <Tarjeta
            icon={FileText}
            titulo={`Documentos adjuntos (${Math.max(solicitud.documentos.length, solicitud.documentosReportados ?? 0)})`}
            extra={<BotonAnexosEnVital idVital={solicitud.idVital} />}
          >
            <p className="text-sm text-stone-400">Consultando la lista de anexos en VITAL…</p>
          </Tarjeta>
        }
      >
        <AnexosVital solicitudId={solicitud.id} idVital={solicitud.idVital} reportados={solicitud.documentosReportados} guardados={solicitud.documentos} />
      </Suspense>

      <p className="flex items-center gap-1.5 text-xs text-stone-400">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        Última sincronización con VITAL: {formatearFechaHora(solicitud.ultimaSincronizacion)}
      </p>
    </div>
  );
}
