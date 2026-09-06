import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, Download, ShieldCheck, Building2, FolderOpen, FolderCheck, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeGestionarExpedienteDeDependencia, puedeCerrarExpediente } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { SectionHelp } from "@/components/Field";
import { SubirDocumentoExpedienteForm } from "@/components/SubirDocumentoExpedienteForm";
import { headers } from "next/headers";

const ETIQUETA_ACCION: Record<string, string> = {
  CREA: "Creación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación", SUSPENDE: "Suspensión de término", REACTIVA: "Reactivación de término",
  TRANSFIERE: "Transferencia a archivo central", DISPONE: "Disposición final",
};

const fechaHora = (d: Date | null | undefined) =>
  d ? d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function ExpedienteDetallePage({
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
  await registrarAuditoriaDoc({ entidad: "ExpedienteDocumental", entidadId: id, accion: "LEE", usuarioId: session.userId, ip, userAgent, detalle: `Consultó ${expediente.numero}` });

  const bitacora = await db.auditoriaDoc.findMany({
    where: { entidad: "ExpedienteDocumental", entidadId: id },
    orderBy: { secuencia: "desc" },
    take: 50,
    include: { usuario: { select: { nombre: true } } },
  });

  const abierto = expediente.estado === "ABIERTO";
  const puedeSubir = abierto && puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId);
  const puedeCerrarEste = abierto && puedeCerrarExpediente(permisos) && expediente.documentos.length > 0;

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

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-stone-500">
          <span>Índice electrónico ({expediente.documentos.length} documento(s))</span>
        </h3>
        <SectionHelp>
          El orden y la huella (hash) de cada documento se actualizan solos al agregar uno nuevo (Art. 4.3.2.3 Acuerdo
          001/2024 AGN). Al cerrar el expediente, este índice queda firmado con hash: si algo cambiara después, dejaría
          de coincidir.
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
                <a
                  href={`/api/documentos-archivo/${doc.id}`}
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

      {puedeCerrarEste && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Cierre del expediente</h3>
          <SectionHelp>
            Ciérrelo cuando termine la actuación o procedimiento que le dio origen (Art. 4.3.2.4 Acuerdo 001/2024 AGN).
            Se firma el índice electrónico con hash y ya no se le pueden agregar documentos ni comunicaciones — es
            definitivo, aunque el expediente en sí nunca se borra.
          </SectionHelp>
          <form action={`/api/correspondencia/expedientes/${id}/cerrar`} method="post">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Cerrar expediente y firmar índice
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Bitácora de auditoría (inalterable)</h3>
        <SectionHelp>
          Registro de todo lo que ha pasado con este expediente. Nadie puede borrar ni editar un registro sin que
          quede evidencia.
        </SectionHelp>
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
      </section>
    </div>
  );
}
