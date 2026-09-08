import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, Download, ShieldCheck, Building2, FolderOpen, FolderCheck, Lock, Pencil, Handshake, Undo2 } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeGestionarExpedienteDeDependencia, puedeCerrarExpediente, puedeAdministrarArchivo, puedeVerNivelAccesoExpediente } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { Field, SectionHelp } from "@/components/Field";
import { SubirDocumentoExpedienteForm } from "@/components/SubirDocumentoExpedienteForm";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { Paginador } from "@/components/Paginador";
import { formatearFecha, formatearFechaHora as fechaHora } from "@/lib/fecha";
import { headers } from "next/headers";

const ETIQUETA_ACCION: Record<string, string> = {
  CREA: "Creación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación", SUSPENDE: "Suspensión de término", REACTIVA: "Reactivación de término",
  TRANSFIERE: "Transferencia a archivo central", DISPONE: "Disposición final",
  PRESTA: "Préstamo", DEVUELVE: "Devolución",
};
const BITACORA_POR_PAGINA = 20;

export default async function ExpedienteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; bp?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");

  const expediente = await db.expedienteDocumental.findUnique({
    where: { id },
    include: {
      dependencia: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true } },
      subserie: { select: { codigo: true, nombre: true } },
      creadoPor: { select: { nombre: true } },
      cerradoPor: { select: { nombre: true } },
      documentos: { orderBy: { ordenIndice: "asc" }, include: { subidoPor: { select: { nombre: true } } } },
      comunicaciones: { orderBy: { fechaRadicacion: "desc" }, select: { id: true, radicado: true, asunto: true } },
    },
  });
  if (!expediente) notFound();

  const { ip, userAgent } = datosPeticion(await headers());

  if (!puedeVerNivelAccesoExpediente(permisos, expediente)) {
    await registrarAuditoriaDoc({
      entidad: "ExpedienteDocumental",
      entidadId: id,
      accion: "ACCESO_DENEGADO",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `${session.nombre} intentó ver ${expediente.numero} (${ETIQUETA_NIVEL_ACCESO[expediente.nivelAcceso] ?? expediente.nivelAcceso}) sin estar autorizado`,
    });
    const mensaje = `No tiene acceso a ${expediente.numero}: quedó clasificada como "${ETIQUETA_NIVEL_ACCESO[expediente.nivelAcceso] ?? expediente.nivelAcceso}".`;
    redirect(`/correspondencia/expedientes?error=${encodeURIComponent(mensaje)}`);
  }

  await registrarAuditoriaDoc({ entidad: "ExpedienteDocumental", entidadId: id, accion: "LEE", usuarioId: session.userId, ip, userAgent, detalle: `Consultó ${expediente.numero}` });

  const bitacoraPage = Math.max(1, parseInt(sp.bp ?? "1", 10) || 1);
  const [totalBitacora, bitacora, prestamoVigente, historialPrestamos, usuariosParaPrestar] = await Promise.all([
    db.auditoriaDoc.count({ where: { entidad: "ExpedienteDocumental", entidadId: id } }),
    db.auditoriaDoc.findMany({
      where: { entidad: "ExpedienteDocumental", entidadId: id },
      orderBy: { secuencia: "desc" },
      skip: (bitacoraPage - 1) * BITACORA_POR_PAGINA,
      take: BITACORA_POR_PAGINA,
      include: { usuario: { select: { nombre: true } } },
    }),
    db.prestamoExpediente.findFirst({
      where: { expedienteDocumentalId: id, fechaDevolucionReal: null },
      include: { prestadoA: { select: { nombre: true } } },
    }),
    db.prestamoExpediente.findMany({
      where: { expedienteDocumentalId: id, fechaDevolucionReal: { not: null } },
      orderBy: { fechaPrestamo: "desc" },
      take: 5,
      include: { prestadoA: { select: { nombre: true } } },
    }),
    db.usuario.findMany({
      where: { activo: true, OR: [{ rol: "ADMIN" }, { rolCorrespondencia: { not: null } }] },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);
  const totalPaginasBitacora = Math.max(1, Math.ceil(totalBitacora / BITACORA_POR_PAGINA));
  const hrefBitacoraPagina = (p: number) => `/correspondencia/expedientes/${id}${p > 1 ? `?bp=${p}` : ""}`;

  const abierto = expediente.estado === "ABIERTO";
  const puedeSubir = abierto && puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId);
  const puedeEditar = abierto && puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId);
  const puedeCerrarEste = abierto && puedeCerrarExpediente(permisos) && expediente.documentos.length > 0;
  const puedePrestar = puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId);

  return (
    <div className="space-y-4">
      <Link href="/correspondencia/expedientes" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a expedientes
      </Link>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-mono text-lg font-semibold text-stone-900">{expediente.numero}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              {expediente.dependencia.nombre}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              abierto ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"
            }`}
          >
            {abierto ? <FolderOpen className="h-3 w-3" aria-hidden /> : <FolderCheck className="h-3 w-3" aria-hidden />}
            {abierto ? "Abierto" : "Cerrado"}
          </span>
        </div>
        {expediente.nivelAcceso !== "PUBLICA" && (
          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASE_NIVEL_ACCESO[expediente.nivelAcceso]}`}>
            {ETIQUETA_NIVEL_ACCESO[expediente.nivelAcceso]}
          </span>
        )}
        <p className="mt-3 text-sm text-stone-700">{expediente.asunto}</p>
        {expediente.descripcion && <p className="mt-1 text-sm text-stone-500">{expediente.descripcion}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-stone-400">Serie (TRD)</dt>
            <dd className="text-sm text-stone-800">{expediente.serie ? `${expediente.serie.codigo} — ${expediente.serie.nombre}` : "Sin clasificar"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">Subserie</dt>
            <dd className="text-sm text-stone-800">{expediente.subserie ? `${expediente.subserie.codigo} — ${expediente.subserie.nombre}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">Abierto por</dt>
            <dd className="text-sm text-stone-800">{expediente.creadoPor.nombre}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">Fecha de apertura</dt>
            <dd className="text-sm text-stone-800">{fechaHora(expediente.fechaApertura)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">Nivel de acceso (Ley 1712/2014)</dt>
            <dd className="text-sm text-stone-800">{ETIQUETA_NIVEL_ACCESO[expediente.nivelAcceso]}</dd>
          </div>
          {expediente.fundamentoNivelAcceso && (
            <div className="sm:col-span-2">
              <dt className="text-[11px] text-stone-400">Fundamento</dt>
              <dd className="text-sm text-stone-800">{expediente.fundamentoNivelAcceso}</dd>
            </div>
          )}
        </dl>

        {!abierto && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
            <Lock className="mt-0.5 h-4 w-4 flex-none text-stone-500" aria-hidden />
            <span>
              Cerrado por <strong>{expediente.cerradoPor?.nombre}</strong> el {fechaHora(expediente.fechaCierre)}. Índice electrónico
              firmado — SHA-256 <span className="font-mono text-xs">{expediente.indiceHash?.slice(0, 24)}…</span>. No se pueden agregar
              más documentos ni comunicaciones.
            </span>
          </div>
        )}
      </div>

      {puedePrestar && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <Handshake className="h-3.5 w-3.5" aria-hidden />
            Préstamo
          </h3>
          <SectionHelp>Registra quién tiene el expediente en este momento — no bloquea subir, editar ni cerrar.</SectionHelp>
          {prestamoVigente ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <span>
                Prestado a <strong>{prestamoVigente.prestadoA.nombre}</strong> desde {formatearFecha(prestamoVigente.fechaPrestamo)}
                {prestamoVigente.fechaDevolucionEsperada && <> · vence {formatearFecha(prestamoVigente.fechaDevolucionEsperada)}</>}
                {prestamoVigente.motivo && <> · {prestamoVigente.motivo}</>}
              </span>
              <form action={`/api/correspondencia/expedientes/${id}/devolver`} method="post">
                <input type="hidden" name="prestamoId" value={prestamoVigente.id} />
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100">
                  <Undo2 className="h-3.5 w-3.5" aria-hidden />
                  Registrar devolución
                </button>
              </form>
            </div>
          ) : (
            <form action={`/api/correspondencia/expedientes/${id}/prestar`} method="post" className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px]">
                <Field label="Prestar a" required>
                  <select name="prestadoAId" required defaultValue="" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                    <option value="" disabled>— Elegir —</option>
                    {usuariosParaPrestar.map((u) => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="min-w-[160px]">
                <Field label="Devolución esperada" help="Opcional.">
                  <input type="date" name="fechaDevolucionEsperada" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
                </Field>
              </div>
              <div className="min-w-[200px] flex-1">
                <Field label="Motivo" help="Opcional.">
                  <input name="motivo" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
                </Field>
              </div>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                <Handshake className="h-3.5 w-3.5" aria-hidden />
                Prestar
              </button>
            </form>
          )}
          {historialPrestamos.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-400">
              {historialPrestamos.map((p) => (
                <li key={p.id}>
                  {p.prestadoA.nombre}: {formatearFecha(p.fechaPrestamo)} → {formatearFecha(p.fechaDevolucionReal)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {puedeEditar && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Asunto y descripción
          </h3>
          <SectionHelp>Lo que identifica a este expediente en el listado — se puede corregir mientras siga abierto.</SectionHelp>
          <form action={`/api/correspondencia/expedientes/${id}/editar`} method="post" className="space-y-3">
            <Field label="Asunto" required>
              <input name="asunto" required defaultValue={expediente.asunto} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="Descripción">
              <input name="descripcion" defaultValue={expediente.descripcion ?? ""} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </Field>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Guardar
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-stone-500">
          <span>Índice electrónico ({expediente.documentos.length} documento(s))</span>
          {expediente.documentos.length > 0 && (
            <span className="flex items-center gap-3 normal-case tracking-normal">
              <a
                href={`/api/correspondencia/expedientes/${id}/indice`}
                className="flex items-center gap-1 text-[11px] font-medium text-cdmb-700 hover:underline"
              >
                <Download className="h-3 w-3" aria-hidden />
                Descargar índice (CSV)
              </a>
              <a
                href={`/api/correspondencia/expedientes/${id}/indice?formato=xml`}
                className="flex items-center gap-1 text-[11px] font-medium text-cdmb-700 hover:underline"
              >
                <Download className="h-3 w-3" aria-hidden />
                XML
              </a>
            </span>
          )}
        </h3>
        <SectionHelp>
          Orden y huella (hash) se actualizan solos al agregar un documento (Art. 4.3.2.3 Acuerdo 001/2024 AGN). Al
          cerrar, el índice queda firmado con hash.
        </SectionHelp>
        {expediente.documentos.length === 0 ? (
          <p className="text-sm text-stone-400">Todavía no se ha agregado ningún documento.</p>
        ) : (
          <ul className="space-y-2">
            {expediente.documentos.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex-none font-mono text-xs text-stone-400">{String(doc.ordenIndice).padStart(3, "0")}</span>
                  <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-stone-800" title={doc.nombre}>{doc.nombre}</span>
                    <span className="flex items-center gap-1 text-[10px] text-stone-400">
                      {doc.subidoPor.nombre} · {fechaHora(doc.createdAt)}
                      {doc.hashSha256 && (
                        <span className="flex items-center gap-1" title={doc.hashSha256}>
                          · <ShieldCheck className="h-3 w-3" aria-hidden /> SHA-256 {doc.hashSha256.slice(0, 12)}…
                        </span>
                      )}
                    </span>
                  </span>
                </span>
                <span className="flex flex-none items-center gap-1.5">
                  <VistaPreviaDocumento url={`/api/documentos-archivo/${doc.id}`} nombre={doc.nombre} mimeType={doc.mimeType} />
                  <a
                    href={`/api/documentos-archivo/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Abrir
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}

        {puedeSubir && (
          <div className="mt-4 border-t border-stone-100 pt-4">
            <SubirDocumentoExpedienteForm expedienteId={id} />
          </div>
        )}
      </section>

      {expediente.comunicaciones.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Comunicaciones archivadas aquí</h3>
          <ul className="space-y-1.5">
            {expediente.comunicaciones.map((c) => (
              <li key={c.id}>
                <Link href={`/correspondencia/${c.id}`} className="text-sm text-cdmb-700 hover:underline">
                  {c.radicado}
                </Link>
                <span className="ml-2 text-xs text-stone-400">{c.asunto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {puedeAdministrarArchivo(permisos) && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Nivel de acceso a la información (Ley 1712/2014)</h3>
          <SectionHelp>
            Pública por defecto (Ley 1712/2014). <strong>Clasificado</strong>: protege un derecho particular.{" "}
            <strong>Reservado</strong>: protege un interés público. Ambos exigen fundamento escrito.
          </SectionHelp>
          <form action={`/api/correspondencia/expedientes/${id}/nivel-acceso`} method="post" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">
              <Field label="Nivel de acceso" required>
                <select name="nivelAcceso" required defaultValue={expediente.nivelAcceso} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                  {(["PUBLICA", "CLASIFICADA", "RESERVADA"] as const).map((n) => (
                    <option key={n} value={n}>{ETIQUETA_NIVEL_ACCESO[n]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="min-w-[260px] flex-1">
              <Field label="Fundamento" help="Obligatorio si elige clasificado o reservado.">
                <input name="fundamento" defaultValue={expediente.fundamentoNivelAcceso ?? ""} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
              </Field>
            </div>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Guardar
            </button>
          </form>
        </section>
      )}

      {puedeCerrarEste && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Cierre del expediente</h3>
          <SectionHelp>
            Al cerrar (Art. 4.3.2.4 Acuerdo 001/2024 AGN) se firma el índice con hash y deja de admitir documentos —
            definitivo, aunque el expediente nunca se borra.
          </SectionHelp>
          <form action={`/api/correspondencia/expedientes/${id}/cerrar`} method="post">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Cerrar expediente y firmar índice
            </button>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Bitácora de auditoría (inalterable)</h3>
          <SectionHelp>Quién y cuándo actuó sobre este expediente — inalterable.</SectionHelp>
          <ul className="divide-y divide-stone-100">
            {bitacora.map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                <span className="text-stone-700">
                  <span className="font-medium">{ETIQUETA_ACCION[b.accion] ?? b.accion}</span>
                  {b.detalle ? ` — ${b.detalle}` : ""}
                </span>
                <span className="text-xs text-stone-400">{b.usuario?.nombre ?? "—"} · {fechaHora(b.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
        <Paginador
          paginaActual={bitacoraPage}
          totalPaginas={totalPaginasBitacora}
          total={totalBitacora}
          porPagina={BITACORA_POR_PAGINA}
          hrefPagina={hrefBitacoraPagina}
        />
      </section>
    </div>
  );
}
