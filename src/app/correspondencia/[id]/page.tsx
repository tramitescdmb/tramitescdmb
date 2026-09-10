import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, FileText, Download, Printer, Send, ShieldCheck, User, Building2, PenTool, Archive, Reply, PauseCircle, PlayCircle, Clock, Ban, FolderTree, Lock, Compass, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import {
  obtenerPermisosUsuario,
  puedeAccederCorrespondencia,
  puedeDistribuir,
  puedeAdministrarArchivo,
  puedeRadicar,
  puedeFirmar,
  puedeResponderComoAsignado,
} from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { listarPlantillas } from "@/lib/plantillas";
import { listarTerminos } from "@/lib/vocabulario";
import { ETIQUETA_TIPO_PQRSD, estadoVencimiento } from "@/lib/pqrsd";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { Field, SectionHelp } from "@/components/Field";
import { ProgresoCorrespondencia } from "@/components/ProgresoCorrespondencia";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { RespuestaFuncionarioForm } from "@/components/RespuestaFuncionarioForm";
import { FlujoTrabajoComunicacion } from "@/components/FlujoTrabajoComunicacion";
import { MetadatosComunicacion } from "@/components/MetadatosComunicacion";
import { SelloFirmaElectronica } from "@/components/SelloFirmaElectronica";
import { puedeOperarFlujos } from "@/lib/flujos";
import { formatearFechaHora as fechaHora } from "@/lib/fecha";
import { headers } from "next/headers";

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada", EN_REPARTO: "En reparto", ASIGNADA: "Asignada", EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Información adicional requerida", RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada", ANULADA: "Anulada",
};
const ETIQUETA_ACCION: Record<string, string> = {
  CREA: "Radicación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación", SUSPENDE: "Suspensión de término", REACTIVA: "Reactivación de término",
  TRANSFIERE: "Transferencia a archivo central", DISPONE: "Disposición final",
};
const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Comunicación recibida", ENVIADA: "Comunicación enviada", INTERNA: "Memorando interno" };
// Estados que cierran el ciclo de esta comunicación — distribuirla de nuevo después de esto pisaría el
// cierre (ej. una RECIBIDA ya respondida volvía a "Asignada" si alguien la distribuía otra vez).
const ESTADOS_CERRADOS = ["RESPONDIDA", "ARCHIVADA", "ANULADA"];

type ProximoPaso = { texto: string; accionHref?: string; accionTexto?: string; cerrado?: boolean };

/**
 * Explica en una frase qué significa el estado actual y qué falta (o no falta nada) — MoReq 8.14, y sobre
 * todo porque un usuario real (autoasignándose una comunicación) no entendió qué hacer ni cómo se "cierra"
 * el ciclo. Clave del malentendido real: una ENVIADA/INTERNA firmada y radicada YA ES definitiva — si se
 * distribuye después es solo seguimiento interno opcional, no un paso pendiente ni algo que "cierre" nada.
 */
function proximoPaso(c: {
  tipo: string;
  estado: string;
  respuestaTexto: string | null;
  respuestas: unknown[];
}, permisos: { puedeDistribuir: boolean; puedeResponder: boolean; puedeRadicar: boolean }): ProximoPaso {
  if (c.tipo !== "RECIBIDA") {
    return { texto: "Ya quedó firmada y radicada — es un documento definitivo. Si la distribuyó a alguien, es solo para que le dé seguimiento por su cuenta; eso no bloquea ni cierra nada más aquí.", cerrado: true };
  }
  // A partir de acá, tipo === "RECIBIDA".
  if (c.estado === "ANULADA") return { texto: "Quedó anulada — no requiere ninguna acción más.", cerrado: true };
  if (c.estado === "ARCHIVADA") return { texto: "Quedó archivada — el ciclo de esta comunicación está cerrado.", cerrado: true };
  if (c.estado === "RESPONDIDA") return { texto: "Ya se le dio respuesta formal (vea \"Respondida por\" arriba). El ciclo de esta recibida quedó cerrado.", cerrado: true };
  if (c.estado === "INFORMACION_ADICIONAL_REQUERIDA") {
    return { texto: "El trámite está detenido (vea el motivo más abajo). Se reanuda cuando se resuelva lo que lo detuvo; si tenía término de ley, se reanuda por lo que faltaba." };
  }
  if (c.estado === "RADICADA" || c.estado === "EN_REPARTO") {
    return permisos.puedeDistribuir
      ? { texto: "Todavía no se ha distribuido. Siguiente paso: asígnela a la dependencia o funcionario que debe atenderla.", accionHref: "#distribucion", accionTexto: "Ir a Distribución / reparto" }
      : { texto: "Todavía no se ha distribuido a nadie." };
  }
  // ASIGNADA o EN_TRAMITE: alguien ya la tiene, falta la respuesta formal.
  if (!c.respuestaTexto) {
    return permisos.puedeResponder
      ? { texto: "Ya está asignada. Siguiente paso: escriba la respuesta más abajo, en \"Respuesta del funcionario\".", accionHref: "#respuesta", accionTexto: "Ir a Respuesta del funcionario" }
      : { texto: "Ya está asignada — falta que el funcionario a cargo escriba la respuesta." };
  }
  if (c.respuestas.length === 0) {
    return permisos.puedeRadicar
      ? { texto: "Ya hay un borrador de respuesta. Siguiente paso: radíquela como oficio de salida para que quede firmada y se cierre el ciclo.", accionHref: "#respuesta", accionTexto: "Ir a radicar la respuesta" }
      : { texto: "Ya hay un borrador de respuesta, falta que alguien con permiso la radique como oficio de salida." };
  }
  return { texto: "Ya se radicó la respuesta — el ciclo de esta recibida está cerrándose.", cerrado: true };
}

function Campo({ k, v }: { k: string; v: ReactNode }) {
  if (v == null || v === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-stone-400">{k}</dt>
      <dd className="text-sm text-stone-800">{v}</dd>
    </div>
  );
}

function Tarjeta({ titulo, children, extra, id }: { titulo: string; children: ReactNode; extra?: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export default async function CorrespondenciaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const c = await db.comunicacion.findUnique({
    where: { id },
    include: {
      documentos: { orderBy: { createdAt: "asc" } },
      dependenciaOrigen: { select: { nombre: true } },
      dependenciaDestino: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true } },
      subserie: { select: { codigo: true, nombre: true } },
      radicadoPor: { select: { nombre: true } },
      expediente: { select: { id: true, numero: true } },
      expedienteDocumental: { select: { id: true, numero: true } },
      respondeA: { select: { id: true, radicado: true, asunto: true } },
      respuestas: { select: { id: true, radicado: true, asunto: true } },
      respuestaPor: { select: { nombre: true } },
      firmas: { orderBy: { fechaHora: "asc" }, include: { usuario: { select: { nombre: true, denominacionEmpleo: true, denominacionComplemento: true, sexo: true, dependencia: { select: { nombre: true } } } } } },
      distribuciones: {
        orderBy: { fechaAsignacion: "desc" },
        include: { dependencia: { select: { nombre: true } }, usuario: { select: { nombre: true } }, asignadoPor: { select: { nombre: true } } },
      },
    },
  });
  if (!c) notFound();

  // Auditoría de LECTURA (requisito MoReq: registrar consultas).
  const { ip, userAgent } = datosPeticion(await headers());
  await registrarAuditoriaDoc({ entidad: "Comunicacion", entidadId: id, accion: "LEE", usuarioId: session.userId, ip, userAgent, detalle: `Consultó ${c.radicado}` });

  const bitacora = await db.auditoriaDoc.findMany({
    where: { entidad: "Comunicacion", entidadId: id },
    orderBy: { secuencia: "desc" },
    take: 50,
    include: { usuario: { select: { nombre: true } } },
  });

  const puedeDistribuirUsuario = puedeDistribuir(permisos);
  const puedeAdministrarArchivoUsuario = puedeAdministrarArchivo(permisos);
  const puedeRadicarUsuario = puedeRadicar(permisos);
  const puedeFirmarUsuario = puedeFirmar(permisos);
  const puedeOperarFlujosUsuario = puedeOperarFlujos(permisos);
  const distribucionVigente = c.distribuciones[0] ?? null;
  const puedeResponder = c.tipo === "RECIBIDA" && puedeResponderComoAsignado(permisos, session.userId, distribucionVigente);
  const documentosOriginales = c.documentos.filter((d) => !d.esRespuesta);
  const documentosRespuesta = c.documentos.filter((d) => d.esRespuesta);
  const plantillasRespuesta = puedeResponder ? await listarPlantillas("RESPUESTA") : [];
  const terminosVocabulario = puedeDistribuirUsuario && c.estado !== "ANULADA" ? await listarTerminos() : [];
  const [dependencias, usuarios] = puedeDistribuirUsuario
    ? await Promise.all([
        listarDependenciasActivas(),
        // Solo quien realmente puede entrar al módulo — repartir a alguien sin rol de
        // correspondencia (y que no sea ADMIN) lo dejaría "asignado" a una comunicación que nunca podrá ver.
        db.usuario.findMany({
          where: { activo: true, OR: [{ rol: "ADMIN" }, { rolCorrespondencia: { not: null } }] },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
      ])
    : [[], []];
  const seriesVigentes = puedeAdministrarArchivoUsuario ? await listarSeriesVigentes() : [];
  const gruposReclasificacion = (() => {
    const mapa = new Map<string, { nombre: string; opciones: { id: string; label: string }[] }>();
    const sinDependencia: { id: string; label: string }[] = [];
    for (const s of seriesVigentes) {
      const opciones = s.subseries.map((ss) => ({ id: ss.id, label: `${ss.codigo} — ${ss.nombre}` }));
      if (!s.dependencia) {
        sinDependencia.push(...opciones);
        continue;
      }
      if (!mapa.has(s.dependencia.id)) mapa.set(s.dependencia.id, { nombre: s.dependencia.nombre, opciones: [] });
      mapa.get(s.dependencia.id)!.opciones.push(...opciones);
    }
    const grupos = Array.from(mapa.values());
    if (sinDependencia.length > 0) grupos.push({ nombre: "Sin dependencia asignada", opciones: sinDependencia });
    return grupos;
  })();

  const tieneTercero = c.tipo !== "INTERNA";
  const vencimiento = estadoVencimiento(c.fechaVencimiento, undefined, await getCalendarioLaboral());
  const siguientePaso = proximoPaso(c, { puedeDistribuir: puedeDistribuirUsuario, puedeResponder, puedeRadicar: puedeRadicarUsuario });

  return (
    <div className="space-y-4">
      <Link href="/correspondencia" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a la bandeja
      </Link>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {c.estado === "ANULADA" && (
        <div className="flex items-start gap-2 rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-700">
          <Ban className="mt-0.5 h-4 w-4 flex-none text-stone-500" aria-hidden />
          <span>
            <strong>Esta comunicación está anulada.</strong> {c.motivoAnulacion ? `Motivo: ${c.motivoAnulacion}` : ""} No se borró:
            queda trazada como constancia (Ley 594/2000).
          </span>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">{c.radicado}</h2>
            <p className="text-xs text-stone-400">
              {ETIQUETA_TIPO[c.tipo] ?? c.tipo}
              {c.tipoPqrsd ? ` · ${ETIQUETA_TIPO_PQRSD[c.tipoPqrsd]}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {vencimiento && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${vencimiento.clase}`}>
                <Clock className="h-3 w-3" aria-hidden />
                {vencimiento.texto}
              </span>
            )}
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{ETIQUETA_ESTADO[c.estado] ?? c.estado}</span>
            {c.nivelAcceso !== "PUBLICA" && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASE_NIVEL_ACCESO[c.nivelAcceso]}`}>
                {ETIQUETA_NIVEL_ACCESO[c.nivelAcceso]}
              </span>
            )}
            <Link href={`/correspondencia/${id}/constancia`} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Constancia
            </Link>
            <Link href={`/correspondencia/${id}/rotulo`} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Rótulo con código de barras
            </Link>
          </div>
        </div>
        <div className="mt-3 max-w-md">
          <ProgresoCorrespondencia estado={c.estado} tipo={c.tipo} tamaño="grande" />
        </div>
        {c.estado !== "ANULADA" && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              siguientePaso.cerrado ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-cdmb-200 bg-cdmb-50 text-cdmb-900"
            }`}
          >
            {siguientePaso.cerrado ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden />
            ) : (
              <Compass className="mt-0.5 h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            )}
            <span>
              {siguientePaso.texto}
              {siguientePaso.accionHref && (
                <>
                  {" "}
                  <a href={siguientePaso.accionHref} className="font-medium underline hover:no-underline">
                    {siguientePaso.accionTexto}
                  </a>
                </>
              )}
            </span>
          </div>
        )}
        <p className="mt-3 text-sm text-stone-700">{c.asunto}</p>
        {c.contenido && <p className="mt-2 whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-sm text-stone-700">{c.contenido}</p>}
        {c.palabrasClave.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.palabrasClave.map((p) => (
              <span key={p} className="rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700">{p}</span>
            ))}
          </div>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          <Campo k="Fecha de radicación" v={fechaHora(c.fechaRadicacion)} />
          <Campo k="Medio" v={c.medio} />
          <Campo k="Folios" v={c.folios} />
          <Campo k="Anexos" v={c.anexosDescripcion} />
          <Campo k="Radicado por" v={c.radicadoPor?.nombre ?? (c.origen === "WEB_PQRSD" ? "Ciudadano (formulario público)" : null)} />
          <Campo k="Dependencia origen" v={c.dependenciaOrigen?.nombre} />
          <Campo k="Dependencia destino" v={c.dependenciaDestino?.nombre} />
          <Campo k="Término de ley" v={c.terminoDiasHabiles ? `${c.terminoDiasHabiles} días hábiles` : null} />
          <Campo k="Vence" v={c.fechaVencimiento ? fechaHora(c.fechaVencimiento) : null} />
          <Campo k="Serie (TRD)" v={c.serie ? `${c.serie.codigo} — ${c.serie.nombre}` : null} />
          <Campo k="Subserie" v={c.subserie ? `${c.subserie.codigo} — ${c.subserie.nombre}` : null} />
          <Campo k="Nivel de acceso (Ley 1712/2014)" v={ETIQUETA_NIVEL_ACCESO[c.nivelAcceso]} />
          {c.fundamentoNivelAcceso && <Campo k="Fundamento" v={c.fundamentoNivelAcceso} />}
          <Campo
            k="Archivada en expediente"
            v={c.expediente ? <Link href={`/expedientes/${c.expediente.id}`} className="text-cdmb-700 hover:underline">{c.expediente.numero}</Link> : null}
          />
          <Campo
            k="Responde a"
            v={c.respondeA ? <Link href={`/correspondencia/${c.respondeA.id}`} className="text-cdmb-700 hover:underline">{c.respondeA.radicado}</Link> : null}
          />
        </dl>
        {c.respuestas.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <Reply className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <span className="text-xs text-stone-500">Respondida por:</span>
            {c.respuestas.map((r) => (
              <Link key={r.id} href={`/correspondencia/${r.id}`} className="rounded-full bg-cdmb-50 px-2.5 py-0.5 text-xs font-medium text-cdmb-700 hover:underline">
                {r.radicado}
              </Link>
            ))}
          </div>
        )}
      </div>

      {tieneTercero && (
        <Tarjeta titulo={c.tipo === "ENVIADA" ? "Destinatario" : "Remitente"}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cdmb-50 text-cdmb-700">
              {c.terceroTipo === "JURIDICA" ? <Building2 className="h-4 w-4" aria-hidden /> : <User className="h-4 w-4" aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">{c.terceroNombre ?? "—"}</p>
              <p className="text-xs text-stone-400">
                {[c.terceroTipoIdentificacion, c.terceroIdentificacion].filter(Boolean).join(" ")}
                {c.terceroMunicipio ? ` · ${c.terceroMunicipio}` : ""}
              </p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Campo k="Correo" v={c.terceroEmail} />
            <Campo k="Teléfono" v={c.terceroTelefono} />
            <Campo k="Dirección" v={c.terceroDireccion} />
          </dl>
        </Tarjeta>
      )}

      {c.firmas.length > 0 && (
        <Tarjeta titulo="Firma electrónica">
          <SelloFirmaElectronica firmas={c.firmas} />
          {puedeFirmarUsuario && c.tipo !== "RECIBIDA" && c.estado !== "ANULADA" && !c.firmas.some((f) => f.usuarioId === session.userId) && (
            <form action={`/api/correspondencia/${id}/firmar`} method="post" className="mt-3">
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                <PenTool className="h-3.5 w-3.5" aria-hidden />
                Agregar mi firma
              </button>
            </form>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo={`Documentos adjuntos (${documentosOriginales.length})`}>
        {documentosOriginales.length > 0 && (
          <SectionHelp>El código SHA-256 es la huella de integridad de cada archivo — cambia si se altera.</SectionHelp>
        )}
        {documentosOriginales.length === 0 ? (
          <p className="text-sm text-stone-400">La comunicación no tiene documentos adjuntos.</p>
        ) : (
          <ul className="space-y-2">
            {documentosOriginales.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-stone-800" title={doc.nombre}>{doc.nombre}</span>
                    {doc.hashSha256 && (
                      <span className="flex items-center gap-1 text-[10px] text-stone-400" title={doc.hashSha256}>
                        <ShieldCheck className="h-3 w-3" aria-hidden /> SHA-256 {doc.hashSha256.slice(0, 12)}…
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex flex-none items-center gap-1.5">
                  <VistaPreviaDocumento url={`/api/correspondencia-documentos/${doc.id}`} nombre={doc.nombre} mimeType={doc.mimeType} miniatura />
                  <a href={`/api/correspondencia-documentos/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Abrir
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta id="distribucion" titulo="Distribución / reparto">
        <SectionHelp>El reparto más reciente (primero en la lista) es el vigente; los anteriores quedan como historial.</SectionHelp>
        {c.distribuciones.length === 0 ? (
          <p className="text-sm text-stone-400">Sin distribuir todavía.</p>
        ) : (
          <ul className="space-y-2">
            {c.distribuciones.map((d, i) => (
              <li key={d.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                <p className="flex items-center gap-2 font-medium text-stone-800">
                  {[d.dependencia?.nombre, d.usuario?.nombre].filter(Boolean).join(" · ") || "—"}
                  {i === 0 && <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cdmb-700">Vigente</span>}
                </p>
                <p className="text-xs text-stone-500">
                  {fechaHora(d.fechaAsignacion)}{d.asignadoPor ? ` · por ${d.asignadoPor.nombre}` : ""}{d.termino ? ` · término ${d.termino} días` : ""}
                </p>
                {d.instrucciones && <p className="mt-1 text-xs text-stone-600">{d.instrucciones}</p>}
              </li>
            ))}
          </ul>
        )}

        {puedeDistribuirUsuario && !ESTADOS_CERRADOS.includes(c.estado) && (
          <form action={`/api/correspondencia/${id}/distribuir`} method="post" className="mt-4 grid grid-cols-1 gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Dependencia" help="El área que debe atenderla.">
              <select name="dependenciaId" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                <option value="">— Ninguna —</option>
                {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
              </select>
            </Field>
            <Field label="Funcionario" help="La persona puntual a cargo, si ya se sabe quién.">
              <select name="usuarioId" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                <option value="">— Ninguno —</option>
                {usuarios.map((u) => (<option key={u.id} value={u.id}>{u.nombre}</option>))}
              </select>
            </Field>
            <Field label="Término (días)" help="Plazo interno, si es distinto al de ley.">
              <input name="termino" type="number" min={1} placeholder="Ej. 15" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Instrucciones" help="Indicaciones puntuales para quien la va a gestionar.">
                <input name="instrucciones" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              </Field>
            </div>
            <div>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
                <Send className="h-3.5 w-3.5" aria-hidden />
                Distribuir
              </button>
            </div>
          </form>
        )}
        {puedeDistribuirUsuario && ESTADOS_CERRADOS.includes(c.estado) && (
          <p className="mt-4 border-t border-stone-100 pt-4 text-xs text-stone-400">
            Ya no se puede distribuir: quedó {ETIQUETA_ESTADO[c.estado]?.toLowerCase() ?? c.estado.toLowerCase()}.
          </p>
        )}
      </Tarjeta>

      <FlujoTrabajoComunicacion
        comunicacionId={c.id}
        tipo={c.tipo}
        estado={c.estado}
        puedeOperar={puedeOperarFlujosUsuario}
      />

      <MetadatosComunicacion
        comunicacionId={c.id}
        serieId={c.serieId}
        metadatos={(c.metadatos as Record<string, unknown> | null) ?? null}
        puedeEditar={puedeDistribuirUsuario}
      />

      {c.tipo === "RECIBIDA" && (
        <Tarjeta id="respuesta" titulo="Respuesta del funcionario">
          <SectionHelp>
            Borrador de respuesta de quien la tiene asignada — no radica nada. Ventanilla o gestión
            documental la retoma para radicarla como oficio de salida (con consecutivo y firma).
          </SectionHelp>
          {c.respuestaTexto && (
            <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-stone-700">{c.respuestaTexto}</p>
              <p className="mt-2 text-xs text-stone-400">
                {c.respuestaPor?.nombre ?? "—"} · {fechaHora(c.respuestaEn)}
              </p>
            </div>
          )}
          {documentosRespuesta.length > 0 && (
            <ul className="mb-3 space-y-2">
              {documentosRespuesta.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                    <span className="truncate text-sm text-stone-800" title={doc.nombre}>{doc.nombre}</span>
                  </span>
                  <span className="flex flex-none items-center gap-1.5">
                    <VistaPreviaDocumento url={`/api/correspondencia-documentos/${doc.id}`} nombre={doc.nombre} mimeType={doc.mimeType} miniatura />
                    <a href={`/api/correspondencia-documentos/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Abrir
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {puedeResponder && c.estado !== "ANULADA" && c.respuestas.length === 0 ? (
            <RespuestaFuncionarioForm
              comunicacionId={id}
              textoInicial={c.respuestaTexto ?? ""}
              plantillas={plantillasRespuesta}
              contexto={{
                RADICADO: c.radicado,
                ASUNTO: c.asunto,
                DESTINATARIO: c.terceroNombre ?? "",
                REMITENTE: c.terceroNombre ?? "",
                FUNCIONARIO: session.nombre,
              }}
            />
          ) : (
            !c.respuestaTexto && <p className="text-sm text-stone-400">Todavía no hay respuesta.</p>
          )}
          {puedeRadicarUsuario && c.respuestaTexto && c.respuestas.length === 0 && (
            <Link
              href={`/correspondencia/nueva/enviada?respondeAId=${id}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-4 py-2 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              Radicar como oficio de salida
            </Link>
          )}
        </Tarjeta>
      )}

      {puedeDistribuirUsuario && c.tipo === "RECIBIDA" && !["ANULADA", "ARCHIVADA", "RESPONDIDA"].includes(c.estado) && (
        <Tarjeta titulo={c.fechaVencimiento ? "Término de ley y estado del trámite" : "Estado del trámite"}>
          <SectionHelp>
            {c.fechaVencimiento
              ? "Plazo legal de respuesta (Ley 1755/2015). Al detener el trámite por falta de información, el conteo del término se congela y se reanuda por lo que faltaba — no se reinicia (Art. 17 CPACA)."
              : "Esta recibida no tiene un término de ley, pero su trámite sí se puede detener (con motivo) mientras se resuelve algo externo — ej. un requerimiento a otra dependencia."}
          </SectionHelp>
          {c.fechaVencimiento && (
            <p className="text-sm text-stone-600">
              {vencimiento?.texto === "Vencido" ? "El término de respuesta venció" : "Vence"} el{" "}
              <span className="font-medium">{fechaHora(c.fechaVencimiento)}</span>
              {c.terminoDiasHabiles ? ` (${c.terminoDiasHabiles} días hábiles desde la radicación)` : ""}.
            </p>
          )}
          {c.estado === "INFORMACION_ADICIONAL_REQUERIDA" ? (
            <>
              <p className="mt-1 text-xs text-stone-500">
                <strong className="text-stone-700">Trámite detenido</strong> desde el {fechaHora(c.fechaSuspensionTermino)}
                {c.motivoSuspension ? ` — ${c.motivoSuspension}` : ""}.
                {c.fechaVencimiento ? " Al reanudarlo, el término se reanuda por los días hábiles que faltaban (Art. 17 CPACA)." : ""}
              </p>
              <form action={`/api/correspondencia/${id}/reactivar`} method="post" className="mt-3">
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
                  <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                  Reanudar el trámite
                </button>
              </form>
            </>
          ) : (
            <form action={`/api/correspondencia/${id}/suspender`} method="post" className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <Field label="Motivo" required help={c.fechaVencimiento ? "Ej. se solicitó información adicional al peticionario." : "Por qué se detiene el trámite."}>
                  <input name="motivo" required className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
                </Field>
              </div>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                <PauseCircle className="h-3.5 w-3.5" aria-hidden />
                Detener el trámite
              </button>
            </form>
          )}
        </Tarjeta>
      )}

      {puedeDistribuirUsuario && (
        <Tarjeta titulo="Expediente de trámite (Trámites 2.0)">
          {c.expediente ? (
            <p className="text-sm text-stone-600">
              Ya está archivada en el expediente{" "}
              <Link href={`/expedientes/${c.expediente.id}`} className="font-medium text-cdmb-700 hover:underline">{c.expediente.numero}</Link>.
            </p>
          ) : (
            <>
              <SectionHelp>Vincula esta comunicación a un expediente de Trámites Ambientales 2.0 ya existente.</SectionHelp>
              <form action={`/api/correspondencia/${id}/archivar`} method="post" className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <Field label="Número de expediente">
                    <input name="numeroExpediente" placeholder="Ej. M-DA-PR05-2026-0001" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
                  </Field>
                </div>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-4 py-2 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50">
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                  Archivar
                </button>
              </form>
            </>
          )}
        </Tarjeta>
      )}

      {puedeDistribuirUsuario && (
        <Tarjeta titulo="Expediente documental (archivo general)">
          {c.expedienteDocumental ? (
            <p className="text-sm text-stone-600">
              Ya está archivada en el expediente{" "}
              <Link href={`/correspondencia/expedientes/${c.expedienteDocumental.id}`} className="font-medium text-cdmb-700 hover:underline">
                {c.expedienteDocumental.numero}
              </Link>.
            </p>
          ) : (
            <>
              <SectionHelp>
                Archivo general de una dependencia (Art. 4.3.2 Acuerdo 001/2024 AGN), para gestiones que no son un
                trámite ambiental. O{" "}
                <Link href="/correspondencia/expedientes/nuevo" className="underline">abra uno nuevo</Link>.
              </SectionHelp>
              <form action={`/api/correspondencia/${id}/archivar-expediente-documental`} method="post" className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <Field label="Número de expediente">
                    <input name="numeroExpedienteDocumental" placeholder="Ej. CDMB-X-2026-000001" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
                  </Field>
                </div>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-4 py-2 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50">
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                  Archivar
                </button>
              </form>
            </>
          )}
        </Tarjeta>
      )}

      {puedeAdministrarArchivoUsuario && c.estado !== "ANULADA" && (
        <Tarjeta titulo="Reclasificación (TRD)">
          <SectionHelp>
            Corrige la clasificación TRD. Queda en la bitácora con la clasificación anterior, la nueva y el motivo;
            aplican los tiempos de retención de la nueva subserie.
          </SectionHelp>
          <form action={`/api/correspondencia/${id}/reclasificar`} method="post" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <Field label="Nueva subserie" required>
                <select name="subserieId" required defaultValue="" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                  <option value="" disabled>— Seleccione —</option>
                  {gruposReclasificacion.map((g) => (
                    <optgroup key={g.nombre} label={g.nombre}>
                      {g.opciones.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
            </div>
            <div className="min-w-[260px] flex-1">
              <Field label="Motivo" required help="Por qué se reclasifica este radicado.">
                <input name="motivo" required className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              </Field>
            </div>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <FolderTree className="h-3.5 w-3.5" aria-hidden />
              Reclasificar
            </button>
          </form>
        </Tarjeta>
      )}

      {puedeDistribuirUsuario && c.estado !== "ANULADA" && (
        <Tarjeta titulo="Palabras clave (vocabulario controlado)">
          <SectionHelp>
            Etiquetas descriptivas para encontrar esta comunicación por tema (MoReq 5.5). Solo se pueden usar
            términos del <strong>vocabulario controlado</strong>, que administra el archivo. Guardar reemplaza la
            selección completa.
          </SectionHelp>
          {terminosVocabulario.length === 0 ? (
            <p className="text-sm text-stone-400">El vocabulario controlado está vacío — pídale a un administrador de archivo que agregue términos.</p>
          ) : (
            <form action={`/api/correspondencia/${id}/palabras-clave`} method="post" className="space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {terminosVocabulario.map((t) => (
                  <label key={t.id} className="flex items-center gap-1.5 text-sm text-stone-700">
                    <input type="checkbox" name="palabra" value={t.termino} defaultChecked={c.palabrasClave.includes(t.termino)} className="rounded border-stone-300" />
                    {t.termino}
                    {t.categoria && <span className="text-[11px] text-stone-400">({t.categoria})</span>}
                  </label>
                ))}
              </div>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                Guardar palabras clave
              </button>
            </form>
          )}
        </Tarjeta>
      )}

      {puedeAdministrarArchivoUsuario && c.estado !== "ANULADA" && (
        <Tarjeta titulo="Nivel de acceso a la información (Ley 1712/2014)">
          <SectionHelp>
            Pública por defecto (Ley 1712/2014). <strong>Clasificada</strong>: protege un derecho particular.{" "}
            <strong>Reservada</strong>: protege un interés público (seguridad, investigaciones en curso). Ambas
            exigen fundamento escrito.
          </SectionHelp>
          <form action={`/api/correspondencia/${id}/nivel-acceso`} method="post" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">
              <Field label="Nivel de acceso" required>
                <select name="nivelAcceso" required defaultValue={c.nivelAcceso} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                  {(["PUBLICA", "CLASIFICADA", "RESERVADA"] as const).map((n) => (
                    <option key={n} value={n}>{ETIQUETA_NIVEL_ACCESO[n]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="min-w-[260px] flex-1">
              <Field label="Fundamento" help="Obligatorio si elige clasificada o reservada; puede dejarlo vacío para pública.">
                <input name="fundamento" defaultValue={c.fundamentoNivelAcceso ?? ""} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              </Field>
            </div>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Guardar
            </button>
          </form>
        </Tarjeta>
      )}

      {puedeAdministrarArchivoUsuario && c.estado !== "ANULADA" && (
        <Tarjeta titulo="Anulación">
          <SectionHelp>
            Solo para radicados por error (duplicados, datos equivocados). No se borra: queda marcada como anulada,
            con motivo, en la bitácora (Ley 594/2000).
          </SectionHelp>
          <form action={`/api/correspondencia/${id}/anular`} method="post" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <Field label="Motivo" required help="Por qué se anula este radicado.">
                <input name="motivo" required className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              </Field>
            </div>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
              <Ban className="h-3.5 w-3.5" aria-hidden />
              Anular esta comunicación
            </button>
          </form>
        </Tarjeta>
      )}

      <Tarjeta titulo="Bitácora de auditoría (inalterable)">
        <SectionHelp>Quién radicó, consultó, distribuyó, firmó o archivó esta comunicación, y cuándo — inalterable.</SectionHelp>
        <ul className="divide-y divide-stone-100">
          {bitacora.map((b) => (
            <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
              <span className="text-stone-700">
                <span className="font-medium">{ETIQUETA_ACCION[b.accion] ?? b.accion}</span>
                {b.detalle ? ` — ${b.detalle}` : ""}
              </span>
              <span className="text-xs text-stone-400">
                {b.usuario?.nombre ?? "—"} · {fechaHora(b.createdAt)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-stone-400">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Cada registro va encadenado por hash SHA-256; alterar o borrar uno rompe la cadena y queda en evidencia.
        </p>
      </Tarjeta>
    </div>
  );
}
