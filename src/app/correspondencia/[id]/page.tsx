import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, FileText, Download, Printer, Send, ShieldCheck, User, Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeDistribuir } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { headers } from "next/headers";

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada", EN_REPARTO: "En reparto", ASIGNADA: "Asignada", EN_TRAMITE: "En trámite",
  RESPONDIDA: "Respondida", ARCHIVADA: "Archivada", ANULADA: "Anulada",
};
const ETIQUETA_ACCION: Record<string, string> = {
  CREA: "Radicación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación",
};

const fechaHora = (d: Date | null | undefined) =>
  d ? d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function Campo({ k, v }: { k: string; v: ReactNode }) {
  if (v == null || v === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-stone-400">{k}</dt>
      <dd className="text-sm text-stone-800">{v}</dd>
    </div>
  );
}

function Tarjeta({ titulo, children, extra }: { titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
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
      dependenciaDestino: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true } },
      subserie: { select: { codigo: true, nombre: true } },
      radicadoPor: { select: { nombre: true } },
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
  const [dependencias, usuarios] = puedeDistribuirUsuario
    ? await Promise.all([
        listarDependenciasActivas(),
        db.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
      ])
    : [[], []];

  return (
    <div className="space-y-4">
      <Link href="/correspondencia" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a la bandeja
      </Link>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">{c.radicado}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{ETIQUETA_ESTADO[c.estado] ?? c.estado}</span>
            <Link href={`/correspondencia/${id}/constancia`} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Constancia
            </Link>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-stone-700">{c.asunto}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          <Campo k="Fecha de radicación" v={fechaHora(c.fechaRadicacion)} />
          <Campo k="Medio" v={c.medio} />
          <Campo k="Folios" v={c.folios} />
          <Campo k="Anexos" v={c.anexosDescripcion} />
          <Campo k="Radicado por" v={c.radicadoPor?.nombre} />
          <Campo k="Dependencia destino" v={c.dependenciaDestino?.nombre} />
          <Campo k="Serie (TRD)" v={c.serie ? `${c.serie.codigo} — ${c.serie.nombre}` : null} />
          <Campo k="Subserie" v={c.subserie ? `${c.subserie.codigo} — ${c.subserie.nombre}` : null} />
        </dl>
      </div>

      <Tarjeta titulo="Remitente">
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

      <Tarjeta titulo={`Documentos adjuntos (${c.documentos.length})`}>
        {c.documentos.length === 0 ? (
          <p className="text-sm text-stone-400">La comunicación no tiene documentos adjuntos.</p>
        ) : (
          <ul className="space-y-2">
            {c.documentos.map((doc) => (
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
                <a href={`/api/correspondencia-documentos/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex flex-none items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Abrir
                </a>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Distribución / reparto">
        {c.distribuciones.length === 0 ? (
          <p className="text-sm text-stone-400">Sin distribuir todavía.</p>
        ) : (
          <ul className="space-y-2">
            {c.distribuciones.map((d) => (
              <li key={d.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                <p className="font-medium text-stone-800">{[d.dependencia?.nombre, d.usuario?.nombre].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-xs text-stone-500">
                  {fechaHora(d.fechaAsignacion)}{d.asignadoPor ? ` · por ${d.asignadoPor.nombre}` : ""}{d.termino ? ` · término ${d.termino} días` : ""}
                </p>
                {d.instrucciones && <p className="mt-1 text-xs text-stone-600">{d.instrucciones}</p>}
              </li>
            ))}
          </ul>
        )}

        {puedeDistribuirUsuario && c.estado !== "ANULADA" && (
          <form action={`/api/correspondencia/${id}/distribuir`} method="post" className="mt-4 grid grid-cols-1 gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className="mb-1 block text-xs font-medium text-stone-600">Dependencia</span>
              <select name="dependenciaId" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                <option value="">— Ninguna —</option>
                {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-stone-600">Funcionario</span>
              <select name="usuarioId" className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
                <option value="">— Ninguno —</option>
                {usuarios.map((u) => (<option key={u.id} value={u.id}>{u.nombre}</option>))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-stone-600">Término (días)</span>
              <input name="termino" type="number" min={1} placeholder="Ej. 15" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2 lg:col-span-4">
              <span className="mb-1 block text-xs font-medium text-stone-600">Instrucciones</span>
              <input name="instrucciones" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            </label>
            <div>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
                <Send className="h-3.5 w-3.5" aria-hidden />
                Distribuir
              </button>
            </div>
          </form>
        )}
      </Tarjeta>

      <Tarjeta titulo="Bitácora de auditoría (inalterable)">
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
