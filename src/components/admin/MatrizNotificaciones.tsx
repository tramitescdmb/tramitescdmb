"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, Square, XCircle, PlugZap, BellRing } from "lucide-react";

export type FilaMatriz = { clave: string; evento: string; categoria: string; destinatarios: string; plataforma: string; envio: string };
export type SeccionMatriz = { modulo: string; nombre: string; filas: FilaMatriz[] };
type Resultado = { estado: "enviando" | "ok" | "error"; mensaje?: string };

const CAMPO = "w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm";
const BOTON = "inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50";
const BOTON_PRINCIPAL = "inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-50";
const PAUSA_MS = 2_100;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Interruptor({ id, clave, activo, alCambiar }: { id: string; clave: string; activo: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap">
      <input id={id} type="checkbox" name="evento" value={clave} checked={activo} onChange={(e) => alCambiar(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-stone-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-cdmb-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-cdmb-300" />
      <span className={`w-16 text-xs ${activo ? "font-medium text-cdmb-700" : "text-stone-500"}`}>{activo ? "Se envía" : "No se envía"}</span>
    </label>
  );
}

function EstadoPrueba({ r }: { r?: Resultado }) {
  if (!r) return null;
  if (r.estado === "enviando") return <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" aria-label="Enviando" />;
  return (
    <span title={r.mensaje} className="inline-flex">
      {r.estado === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Enviada" /> : <XCircle className="h-3.5 w-3.5 text-red-600" aria-label="Error" />}
    </span>
  );
}

export function MatrizNotificaciones({
  secciones,
  activosIniciales,
  correoPrueba,
  cuentas,
  urlPlataforma,
  urlEfectiva,
}: {
  secciones: SeccionMatriz[];
  activosIniciales: string[];
  correoPrueba: string;
  cuentas: { id: string; etiqueta: string; predeterminada: boolean }[];
  urlPlataforma: string;
  urlEfectiva: string | null;
}) {
  const [activos, setActivos] = useState(() => new Set(activosIniciales));
  const [correo, setCorreo] = useState(correoPrueba);
  const [cuentaId, setCuentaId] = useState(cuentas.find((c) => c.predeterminada)?.id ?? cuentas[0]?.id ?? "");
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [lote, setLote] = useState<{ total: number; hechos: number; fallidos: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const detener = useRef(false);

  const todas = secciones.flatMap((s) => s.filas.map((f) => f.clave));
  const inicial = new Set(activosIniciales);
  const cambios = todas.filter((c) => activos.has(c) !== inicial.has(c)).length;
  const ocupado = lote !== null || Object.values(resultados).some((r) => r.estado === "enviando");

  const marcar = (claves: string[], valor: boolean) =>
    setActivos((prev) => {
      const s = new Set(prev);
      for (const c of claves) {
        if (valor) s.add(c);
        else s.delete(c);
      }
      return s;
    });

  async function probar(clave: string): Promise<boolean> {
    setResultados((p) => ({ ...p, [clave]: { estado: "enviando" } }));
    let r: Resultado;
    try {
      const resp = await fetch("/api/admin/correo/prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, destino: correo.trim(), cuentaId: cuentaId || undefined }),
      });
      const datos = (await resp.json().catch(() => ({ ok: false, mensaje: "Respuesta inválida del servidor." }))) as { ok: boolean; mensaje: string };
      r = { estado: datos.ok ? "ok" : "error", mensaje: datos.mensaje };
    } catch {
      r = { estado: "error", mensaje: "No se pudo contactar el servidor." };
    }
    setResultados((p) => ({ ...p, [clave]: r }));
    return r.estado === "ok";
  }

  function correoListo() {
    if (CORREO.test(correo.trim())) {
      setAviso(null);
      return true;
    }
    setAviso("Indique un correo de prueba válido.");
    return false;
  }

  async function probarVarias(claves: string[]) {
    if (!correoListo() || claves.length === 0) return;
    detener.current = false;
    let fallidos = 0;
    setLote({ total: claves.length, hechos: 0, fallidos: 0 });
    for (const [i, clave] of claves.entries()) {
      if (detener.current) break;
      if (i > 0) await new Promise((listo) => setTimeout(listo, PAUSA_MS));
      if (detener.current) break;
      if (!(await probar(clave))) fallidos++;
      setLote({ total: claves.length, hechos: i + 1, fallidos });
    }
    setLote(null);
    setAviso(detener.current ? "Pruebas detenidas." : `Pruebas terminadas: ${claves.length - fallidos} enviada(s)${fallidos ? `, ${fallidos} con error` : ""}.`);
  }

  return (
    <form id="matriz" action="/api/admin/correo/avisos" method="post" className="rounded-md border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <BellRing className="h-4 w-4" aria-hidden /> Matriz de notificaciones
        </p>
        <span className="text-xs text-stone-500">
          {activos.size} de {todas.length} se envían por correo
          {cambios > 0 && <span className="ml-1.5 font-medium text-amber-700">· {cambios} cambio(s) sin guardar</span>}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
            Seleccionar:
            <button type="button" onClick={() => marcar(todas, true)} className="font-medium text-cdmb-700 hover:underline">Todas</button>
            <span aria-hidden>·</span>
            <button type="button" onClick={() => marcar(todas, false)} className="font-medium text-cdmb-700 hover:underline">Ninguna</button>
          </span>
          <button type="submit" disabled={ocupado} className={BOTON_PRINCIPAL}>Guardar matriz</button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-stone-100 bg-stone-50/70 px-4 py-3">
        <label className="min-w-60 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Correo de prueba</span>
          <input name="correoPrueba" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@cdmb.gov.co" className={`${CAMPO} bg-white`} />
        </label>
        {cuentas.length > 1 && (
          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-500">Cuenta</span>
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className={`${CAMPO} bg-white`}>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.etiqueta}</option>
              ))}
            </select>
          </label>
        )}
        <button type="button" disabled={ocupado} onClick={() => correoListo() && probar("conexion")} className={`${BOTON} py-1.5`}>
          <PlugZap className="h-3.5 w-3.5" aria-hidden /> Probar conexión
          <EstadoPrueba r={resultados.conexion} />
        </button>
        {lote ? (
          <button type="button" onClick={() => (detener.current = true)} className={`${BOTON} py-1.5`}>
            <Square className="h-3.5 w-3.5" aria-hidden /> Detener · {lote.hechos} de {lote.total}
          </button>
        ) : (
          <button type="button" disabled={ocupado} onClick={() => probarVarias(todas)} className={`${BOTON} py-1.5`}>
            <Send className="h-3.5 w-3.5" aria-hidden /> Probar todas ({todas.length})
          </button>
        )}
        {(aviso || resultados.conexion?.mensaje) && (
          <p className={`basis-full text-xs ${aviso?.startsWith("Indique") || resultados.conexion?.estado === "error" ? "text-red-700" : "text-stone-600"}`}>
            {aviso ?? resultados.conexion?.mensaje}
          </p>
        )}
      </div>

      <div className="overflow-x-auto border-t border-stone-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="hidden px-4 py-2 font-medium lg:table-cell">Categoría</th>
              <th className="px-4 py-2 font-medium lg:pl-2">Evento</th>
              <th className="hidden px-2 py-2 font-medium sm:table-cell">Destinatarios</th>
              <th className="hidden px-2 py-2 font-medium xl:table-cell">Siempre visible en</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">Envío</th>
              <th className="px-2 py-2 text-center font-medium">Correo</th>
              <th className="px-4 py-2 text-right font-medium">Prueba</th>
            </tr>
          </thead>
          {secciones.map((s) => {
            const claves = s.filas.map((f) => f.clave);
            const encendidas = claves.filter((c) => activos.has(c)).length;
            return (
              <tbody key={s.modulo}>
                <tr className="border-b border-stone-200 bg-stone-100/80">
                  <td colSpan={7} className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-stone-900">{s.nombre}</span>
                      <span className="text-xs text-stone-500">{encendidas} de {claves.length}</span>
                      <span className="ml-auto inline-flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-stone-500">
                          <button type="button" onClick={() => marcar(claves, true)} className="font-medium text-cdmb-700 hover:underline">Todas</button>
                          <span aria-hidden>·</span>
                          <button type="button" onClick={() => marcar(claves, false)} className="font-medium text-cdmb-700 hover:underline">Ninguna</button>
                        </span>
                        <button type="button" disabled={ocupado} onClick={() => probarVarias(claves)} className={BOTON}>
                          <Send className="h-3.5 w-3.5" aria-hidden /> Probar el módulo
                        </button>
                      </span>
                    </div>
                  </td>
                </tr>
                {s.filas.map((f, i) => {
                  const primera = i === 0 || s.filas[i - 1]!.categoria !== f.categoria;
                  const filasCategoria = primera ? s.filas.slice(i).findIndex((x) => x.categoria !== f.categoria) : 0;
                  const r = resultados[f.clave];
                  return (
                    <tr key={f.clave} className="border-b border-stone-100 last:border-0 align-top">
                      {primera && (
                        <td rowSpan={filasCategoria === -1 ? s.filas.length - i : filasCategoria} className="hidden border-r border-stone-100 px-4 py-1.5 text-xs font-medium text-stone-600 lg:table-cell">
                          {f.categoria}
                        </td>
                      )}
                      <td className="px-4 py-1.5 lg:pl-2">
                        <label htmlFor={`evento-${f.clave}`} className="cursor-pointer">{f.evento}</label>
                        <span className="block text-[11px] text-stone-500 sm:hidden">{f.destinatarios}</span>
                        {r && r.estado !== "enviando" && (
                          <span className={`block text-[11px] ${r.estado === "ok" ? "text-emerald-700" : "text-red-700"}`}>{r.mensaje}</span>
                        )}
                      </td>
                      <td className="hidden px-2 py-1.5 text-xs text-stone-600 sm:table-cell">{f.destinatarios}</td>
                      <td className="hidden px-2 py-1.5 text-xs text-stone-500 xl:table-cell">{f.plataforma}</td>
                      <td className="hidden whitespace-nowrap px-2 py-1.5 text-xs text-stone-500 md:table-cell">{f.envio}</td>
                      <td className="px-2 py-1.5">
                        <Interruptor id={`evento-${f.clave}`} clave={f.clave} activo={activos.has(f.clave)} alCambiar={(v) => marcar([f.clave], v)} />
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <EstadoPrueba r={r} />
                          <button type="button" disabled={ocupado} onClick={() => correoListo() && probar(f.clave)} className={BOTON} title={`Enviar la plantilla de «${f.evento}» al correo de prueba`}>
                            <Send className="h-3.5 w-3.5" aria-hidden /> Probar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-stone-100 px-4 py-3">
        <label className="min-w-72 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Dirección de la plataforma para los enlaces de los correos</span>
          <input name="urlPlataforma" defaultValue={urlPlataforma} placeholder={urlEfectiva ?? "https://tramites.cdmb.gov.co"} className={CAMPO} />
        </label>
        <span className="pb-2 text-xs text-stone-500">{urlEfectiva ? `En uso: ${urlEfectiva}` : "Sin dirección: los correos salen sin enlace."}</span>
      </div>
    </form>
  );
}
