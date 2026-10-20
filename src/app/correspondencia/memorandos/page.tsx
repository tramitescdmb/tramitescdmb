import Link from "next/link";
import { redirect } from "next/navigation";
import { FileEdit, Reply, MailOpen } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contarMemorandos, contextoMemorandos, listarMemorandos, VISTAS_MEMORANDOS, type VistaMemorandos } from "@/lib/memorandos";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { estadoVencimiento } from "@/lib/pqrsd";
import { formatearFecha } from "@/lib/fecha";
import { CabeceraTablero } from "@/components/tablero";
import { EstadoComunicacionBadge } from "@/components/EstadoBadge";

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicado",
  EN_REPARTO: "En reparto",
  ASIGNADA: "Asignado",
  EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Info. requerida",
  RESPONDIDA: "Respondido",
  ARCHIVADA: "Archivado",
  ANULADA: "Anulado",
};

const VACIO: Record<VistaMemorandos, string> = {
  "por-responder": "No tiene memorandos pendientes de respuesta.",
  "sin-leer": "No tiene memorandos sin leer.",
  recibidos: "Aún no ha recibido memorandos.",
  esperando: "Ninguno de sus memorandos está esperando respuesta.",
  enviados: "Aún no ha enviado memorandos.",
};

export default async function MemorandosPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const permisos = await obtenerPermisosUsuario(session.userId);
  const ctx = await contextoMemorandos(session.userId, permisos);
  const [conteos, calendario] = await Promise.all([contarMemorandos(ctx), getCalendarioLaboral()]);
  const vistaPorDefecto: VistaMemorandos = conteos.porResponder > 0 ? "por-responder" : conteos.sinLeer > 0 ? "sin-leer" : "recibidos";
  const vista = VISTAS_MEMORANDOS.some((v) => v.id === sp.vista) ? (sp.vista as VistaMemorandos) : vistaPorDefecto;
  const filas = await listarMemorandos(ctx, vista);
  const enviados = vista === "esperando" || vista === "enviados";
  const contador: Partial<Record<VistaMemorandos, number>> = {
    "por-responder": conteos.porResponder,
    "sin-leer": conteos.sinLeer,
    esperando: conteos.esperando,
  };

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={FileEdit}
        titulo="Memorandos"
        descripcion="Comunicaciones internas entre dependencias: las que debe responder, las que no ha leído y las que esperan respuesta de otras oficinas."
        acciones={
          ctx.firmante ? (
            <Link
              href="/correspondencia/nueva/interna"
              className="inline-flex items-center gap-1.5 rounded bg-acento-500 px-3 py-2 text-sm font-semibold text-white hover:bg-acento-600"
            >
              <FileEdit className="h-4 w-4" aria-hidden />
              Nuevo memorando
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
        <nav className="flex flex-wrap border-b border-stone-200" aria-label="Vistas de memorandos">
          {VISTAS_MEMORANDOS.map((v) => {
            const sel = v.id === vista;
            const n = contador[v.id];
            return (
              <Link
                key={v.id}
                href={`/correspondencia/memorandos?vista=${v.id}`}
                aria-current={sel ? "page" : undefined}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                  sel ? "border-cdmb-600 font-semibold text-stone-900" : "border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                {v.label}
                {n !== undefined && n > 0 && (
                  <span
                    className={`rounded-sm px-1.5 text-[11px] font-semibold tabular-nums ${
                      v.id === "por-responder" && conteos.vencidos > 0 ? "bg-red-500 text-white" : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {filas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-stone-400">{VACIO[vista]}</p>
        ) : (
          <table className="tabla-listado w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Radicado</th>
                <th className="px-3 py-2">Asunto</th>
                <th className="px-3 py-2">{enviados ? "Para" : "De"}</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Responder antes de</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => {
                const miDistribucion = m.distribuciones.find((d) => d.usuarioId === session.userId);
                const sinLeer = !enviados && miDistribucion && !miDistribucion.fechaAcuse;
                const pendiente = m.fechaVencimiento && !["RESPONDIDA", "ANULADA", "ARCHIVADA"].includes(m.estado);
                const v = pendiente ? estadoVencimiento(m.fechaVencimiento, undefined, calendario) : null;
                const destinatario = m.distribuciones.map((d) => d.usuario?.nombre).filter(Boolean).join(", ");
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2 align-top">
                      <Link href={`/correspondencia/${m.id}`} className={`text-cdmb-700 hover:underline ${sinLeer ? "font-bold" : "font-medium"}`}>
                        {m.radicado}
                      </Link>
                      {sinLeer && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-sm bg-acento-100 px-1 text-[10px] font-semibold text-acento-800">
                          <MailOpen className="h-3 w-3" aria-hidden />
                          Nuevo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className={`line-clamp-2 ${sinLeer ? "font-semibold text-stone-900" : "text-stone-700"}`}>{m.asunto}</span>
                      {m.respondeA && (
                        <Link href={`/correspondencia/${m.respondeA.id}`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-cdmb-700">
                          <Reply className="h-3 w-3" aria-hidden />
                          Responde a {m.respondeA.radicado}
                        </Link>
                      )}
                    </td>
                    <td className="max-w-[16rem] px-3 py-2 align-top text-xs text-stone-600">
                      {enviados ? (
                        <>
                          <span className="block">{m.dependenciaDestino?.nombre ?? "—"}</span>
                          {destinatario && <span className="block text-stone-400">{destinatario}</span>}
                        </>
                      ) : (
                        <>
                          <span className="block">{m.dependenciaOrigen?.nombre ?? "—"}</span>
                          {m.radicadoPor && <span className="block text-stone-400">{m.radicadoPor.nombre}</span>}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-stone-600">{formatearFecha(m.fechaRadicacion)}</td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-xs">
                      {m.fechaVencimiento ? (
                        <>
                          <span className="block text-stone-700">{formatearFecha(m.fechaVencimiento)}</span>
                          {v && <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${v.clase}`}>{v.texto}</span>}
                        </>
                      ) : (
                        <span className="text-stone-400">Informativo</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 align-top">
                      <EstadoComunicacionBadge estado={m.estado} etiqueta={ETIQUETA_ESTADO[m.estado] ?? m.estado} />
                      {m.respuestas[0] && (
                        <Link href={`/correspondencia/${m.respuestas[0].id}`} className="block text-[11px] text-cdmb-700 hover:underline">
                          Respuesta {m.respuestas[0].radicado}
                        </Link>
                      )}
                      {vista === "por-responder" && m.respuestaTexto && (
                        <span className="block text-[11px] text-emerald-700">Respuesta proyectada por {m.respuestaPor?.nombre ?? "—"}</span>
                      )}
                      {vista === "por-responder" && (
                        <Link
                          href={ctx.firmante ? `/correspondencia/nueva/interna?respondeAId=${m.id}` : `/correspondencia/${m.id}#proyectar`}
                          className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-acento-700 hover:underline"
                        >
                          <Reply className="h-3 w-3" aria-hidden />
                          {ctx.firmante ? "Firmar y enviar respuesta" : "Proyectar respuesta"}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
