"use client";

import { useEffect, useRef, useState } from "react";
import { cargarCapasZonificacion, zonificarPunto, type ResultadoZonificacion } from "@/lib/zonificacion";
import { Crosshair, Plus, Trash2, RotateCcw, Info } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import {
  aDms,
  cumplimientoFila,
  formatearNumero,
  OPCIONES_CUMPLIMIENTO,
  resolverPlantilla,
  totalColumna,
  valorColumnaFila,
  valorNumericoCampo,
  type Campo,
  type DatosPrecarga,
  type EstructuraFormato,
  type FilaTabla,
  type Respuestas,
  type ValorCampo,
  type ValorChequeo,
  type ValorCoordenadas,
} from "@/lib/formato-visita";
import { desdeLatLon, planasOrigenBogota } from "@/lib/coordenadas";
import { MapaEstatico } from "@/components/formatos/MapaEstatico";

const campoCls = "w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500 disabled:bg-stone-50 disabled:text-stone-500";
const celdaCls = "w-full min-w-[5.5rem] rounded border border-stone-200 bg-white px-1.5 py-1 text-xs focus:border-vivo-500 focus:outline-none disabled:bg-stone-50";

export function FormularioFormato({
  estructura,
  respuestas,
  precarga,
  onCambio,
  soloLectura = false,
  faltantes,
  onZonificar,
  renderFotos,
}: {
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  onCambio: (id: string, valor: ValorCampo) => void;
  soloLectura?: boolean;
  faltantes?: Set<string>;
  onZonificar?: (coordenadasId: string, zona: ResultadoZonificacion) => void;
  renderFotos?: () => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {estructura.secciones.map((s) => (
        <section key={s.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <h3 className="mb-3 border-b border-stone-100 pb-2 text-sm font-semibold uppercase tracking-wide text-stone-800">{s.titulo}</h3>
          {s.campos.length === 0 ? (
            <p className="text-xs text-stone-400">Sección sin campos.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {s.campos.map((c) => (
                <div key={c.id} className={anchoCompleto(c) ? "sm:col-span-2" : ""}>
                  <CampoFormato
                    campo={c}
                    estructura={estructura}
                    respuestas={respuestas}
                    precarga={precarga}
                    onCambio={onCambio}
                    soloLectura={soloLectura}
                    falta={faltantes?.has(c.id) ?? false}
                    onZonificar={onZonificar}
                    renderFotos={renderFotos}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function anchoCompleto(c: Campo): boolean {
  return c.tipo === "parrafo" || c.tipo === "tabla" || c.tipo === "fotos" || c.tipo === "lista_chequeo" || c.tipo === "coordenadas" || c.etiqueta.length > 60;
}

function Etiqueta({ campo, falta }: { campo: Campo; falta: boolean }) {
  return (
    <span className={`mb-0.5 flex items-start gap-1 text-xs font-medium ${falta ? "text-red-700" : "text-stone-600"}`}>
      <span>
        {campo.etiqueta}
        {campo.obligatorio && <span className="text-red-600"> *</span>}
      </span>
      {campo.ayuda && (
        <span title={campo.ayuda} className="mt-px cursor-help text-stone-400">
          <Info className="h-3.5 w-3.5" aria-label={campo.ayuda} />
        </span>
      )}
    </span>
  );
}

function CampoFormato({
  campo,
  estructura,
  respuestas,
  precarga,
  onCambio,
  soloLectura,
  falta,
  onZonificar,
  renderFotos,
}: {
  campo: Campo;
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  onCambio: (id: string, valor: ValorCampo) => void;
  soloLectura: boolean;
  falta: boolean;
  onZonificar?: (coordenadasId: string, zona: ResultadoZonificacion) => void;
  renderFotos?: () => React.ReactNode;
}) {
  const v = respuestas[campo.id];
  const str = typeof v === "string" ? v : "";
  const borde = falta ? " border-red-300 ring-1 ring-red-200" : "";

  switch (campo.tipo) {
    case "texto":
      if (campo.multiple) return <CampoMultiple campo={campo} valor={str} onCambio={(x) => onCambio(campo.id, x)} soloLectura={soloLectura} falta={falta} />;
      return (
        <label className="block">
          <Etiqueta campo={campo} falta={falta} />
          <input aria-label={campo.etiqueta} value={str} onChange={(e) => onCambio(campo.id, e.target.value)} disabled={soloLectura} maxLength={1000} className={campoCls + borde} />
        </label>
      );
    case "fecha":
      return (
        <label className="block">
          <Etiqueta campo={campo} falta={falta} />
          <input aria-label={campo.etiqueta} type="date" value={str} onChange={(e) => onCambio(campo.id, e.target.value)} disabled={soloLectura} className={campoCls + borde} />
        </label>
      );
    case "numero":
      return (
        <label className="block">
          <Etiqueta campo={campo} falta={falta} />
          <span className="flex items-center gap-1.5">
            <input aria-label={campo.etiqueta} value={str} onChange={(e) => onCambio(campo.id, e.target.value)} disabled={soloLectura} inputMode="decimal" className={campoCls + borde} />
            {campo.unidad && <span className="flex-none text-xs text-stone-500">{campo.unidad}</span>}
          </span>
        </label>
      );
    case "seleccion":
      return (
        <label className="block">
          <Etiqueta campo={campo} falta={falta} />
          <select aria-label={campo.etiqueta} value={str} onChange={(e) => onCambio(campo.id, e.target.value)} disabled={soloLectura} className={campoCls + borde}>
            <option value="">Seleccione…</option>
            {(campo.opciones ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    case "si_no":
      return (
        <div>
          <Etiqueta campo={campo} falta={falta} />
          <div className="flex gap-1.5" role="group" aria-label={campo.etiqueta}>
            {["Sí", "No"].map((o) => (
              <button
                key={o}
                type="button"
                disabled={soloLectura}
                onClick={() => onCambio(campo.id, str === o ? "" : o)}
                aria-pressed={str === o}
                className={`min-w-16 rounded-md border px-3 py-1.5 text-sm ${str === o ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"}${borde}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    case "calculado": {
      const n = valorNumericoCampo(estructura, respuestas, campo.id);
      return (
        <div>
          <Etiqueta campo={campo} falta={false} />
          <p className="rounded-md border border-dashed border-stone-200 bg-stone-50 px-2.5 py-1.5 text-sm font-medium text-stone-800">
            {n == null ? <span className="font-normal text-stone-400">Se calcula al completar los datos</span> : `${formatearNumero(n, campo.decimales ?? 2)}${campo.unidad ? ` ${campo.unidad}` : ""}`}
          </p>
        </div>
      );
    }
    case "parrafo":
      return (
        <div>
          <div className="flex items-end justify-between gap-2">
            <Etiqueta campo={campo} falta={falta} />
            {campo.plantilla && !soloLectura && (
              <button
                type="button"
                onClick={() => {
                  const nuevo = resolverPlantilla(campo.plantilla!, estructura, respuestas, precarga);
                  if (!str.trim() || str === nuevo || window.confirm("¿Reemplazar el texto actual por el texto tipo con los datos diligenciados?")) onCambio(campo.id, nuevo);
                }}
                className="mb-0.5 inline-flex flex-none items-center gap-1 text-[11px] font-medium text-cdmb-700 hover:underline"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Texto tipo
              </button>
            )}
          </div>
          <textarea aria-label={campo.etiqueta} value={str} onChange={(e) => onCambio(campo.id, e.target.value)} disabled={soloLectura} rows={Math.min(10, Math.max(3, Math.ceil(str.length / 90)))} className={campoCls + borde} />
        </div>
      );
    case "coordenadas":
      return (
        <CampoCoordenadas
          campo={campo}
          valor={v as ValorCoordenadas | undefined}
          onCambio={(x) => onCambio(campo.id, x)}
          soloLectura={soloLectura}
          falta={falta}
          onZonificar={onZonificar ? (z) => onZonificar(campo.id, z) : undefined}
        />
      );
    case "lista_chequeo": {
      const val = (v as ValorChequeo | undefined) ?? { marcados: [] };
      return (
        <div>
          <Etiqueta campo={campo} falta={falta} />
          <ul className={`space-y-1.5 rounded-md border border-stone-200 p-2${borde}`}>
            {(campo.items ?? []).map((it, i) => {
              const marcado = val.marcados.includes(i);
              return (
                <li key={i}>
                  <label className={`flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs leading-relaxed ${marcado ? "text-stone-800" : "text-stone-400"}`}>
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={soloLectura}
                      onChange={() => onCambio(campo.id, { ...val, marcados: marcado ? val.marcados.filter((x) => x !== i) : [...val.marcados, i].sort((a, b) => a - b) })}
                      className="mt-0.5 flex-none text-cdmb-600"
                    />
                    <span>{resolverPlantilla(it.texto, estructura, respuestas, precarga)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <textarea
            value={val.adicional ?? ""}
            onChange={(e) => onCambio(campo.id, { ...val, adicional: e.target.value })}
            disabled={soloLectura}
            rows={2}
            placeholder="Texto adicional (opcional)"
            className={`mt-1.5 ${campoCls}`}
          />
        </div>
      );
    }
    case "fotos":
      return (
        <div>
          <Etiqueta campo={campo} falta={false} />
          {renderFotos ? (
            renderFotos()
          ) : (
            <p className="rounded-md border border-dashed border-stone-300 px-3 py-4 text-center text-xs text-stone-500">Aquí el técnico toma o adjunta las fotos de la visita (máximo 10, de hasta 2 MB cada una) con su pie de foto.</p>
          )}
        </div>
      );
    case "tabla":
      return <CampoTabla campo={campo} valor={Array.isArray(v) ? v : []} onCambio={(x) => onCambio(campo.id, x)} soloLectura={soloLectura} falta={falta} />;
  }
}

function CampoCoordenadas({
  campo,
  valor,
  onCambio,
  soloLectura,
  falta,
  onZonificar,
}: {
  campo: Campo;
  valor: ValorCoordenadas | undefined;
  onCambio: (v: ValorCoordenadas) => void;
  soloLectura: boolean;
  falta: boolean;
  onZonificar?: (z: ResultadoZonificacion) => void;
}) {
  const v = valor ?? { lat: null, lon: null, cota: "" };
  const [zona, setZona] = useState<ResultadoZonificacion | null>(null);
  const avisar = useRef(onZonificar);
  avisar.current = onZonificar;
  useEffect(() => {
    if (v.lat == null || v.lon == null) {
      setZona(null);
      return;
    }
    let vigente = true;
    const t = setTimeout(() => {
      cargarCapasZonificacion()
        .then((capas) => {
          if (!vigente || Object.keys(capas).length === 0) return;
          const z = zonificarPunto(v.lat!, v.lon!, capas);
          setZona(z);
          avisar.current?.(z);
        })
        .catch(() => null);
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [v.lat, v.lon]);
  const [capturando, setCapturando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latTxt, setLatTxt] = useState(v.lat != null ? String(v.lat) : "");
  const [lonTxt, setLonTxt] = useState(v.lon != null ? String(v.lon) : "");

  function capturar() {
    setError(null);
    if (!navigator.geolocation) return setError("Este dispositivo no permite capturar la ubicación.");
    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lon = Number(pos.coords.longitude.toFixed(7));
        setLatTxt(String(lat));
        setLonTxt(String(lon));
        const cota = pos.coords.altitude != null && !v.cota ? String(Math.round(pos.coords.altitude)) : v.cota;
        onCambio({ ...v, lat, lon, cota, precisionM: pos.coords.accuracy ?? null });
        setCapturando(false);
      },
      () => {
        setError("No fue posible obtener la ubicación. Ingrésela manualmente.");
        setCapturando(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function manual(latS: string, lonS: string) {
    setLatTxt(latS);
    setLonTxt(lonS);
    const lat = Number(latS.replace(",", "."));
    const lon = Number(lonS.replace(",", "."));
    const ok = latS.trim() && lonS.trim() && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    onCambio({ ...v, lat: ok ? lat : null, lon: ok ? lon : null, precisionM: null });
  }

  const listo = v.lat != null && v.lon != null;
  const nacional = listo ? desdeLatLon(v.lat!, v.lon!) : null;
  const bogota = listo ? planasOrigenBogota(v.lat!, v.lon!) : null;

  return (
    <div>
      <Etiqueta campo={campo} falta={falta} />
      <div className={`space-y-2 rounded-md border border-stone-200 p-2.5${falta ? " border-red-300" : ""}`}>
        <div className="flex flex-wrap items-end gap-2">
          {!soloLectura && (
            <button
              type="button"
              onClick={capturar}
              disabled={capturando}
              className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
            >
              {capturando ? <Spinner claro /> : <Crosshair className="h-4 w-4" aria-hidden />}
              {capturando ? "Obteniendo…" : "Capturar GPS"}
            </button>
          )}
          <label className="text-[11px] text-stone-500">
            Latitud
            <input value={latTxt} onChange={(e) => manual(e.target.value, lonTxt)} disabled={soloLectura} inputMode="decimal" placeholder="7.0182" className={`mt-0.5 w-28 ${campoCls}`} />
          </label>
          <label className="text-[11px] text-stone-500">
            Longitud
            <input value={lonTxt} onChange={(e) => manual(latTxt, e.target.value)} disabled={soloLectura} inputMode="decimal" placeholder="-73.0181" className={`mt-0.5 w-28 ${campoCls}`} />
          </label>
          {campo.conCota && (
            <label className="text-[11px] text-stone-500">
              Cota (m s. n. m.)
              <input value={v.cota ?? ""} onChange={(e) => onCambio({ ...v, cota: e.target.value })} disabled={soloLectura} inputMode="decimal" className={`mt-0.5 w-24 ${campoCls}`} />
            </label>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {listo && nacional && bogota && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] text-stone-600 sm:grid-cols-3">
            <div>
              <dt className="text-stone-400">Geográficas</dt>
              <dd>
                {aDms(v.lat!, true)} · {aDms(v.lon!, false)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-400">Planas origen nacional</dt>
              <dd>
                N {formatearNumero(nacional.planaY, 0)} · E {formatearNumero(nacional.planaX, 0)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-400">Planas origen Bogotá</dt>
              <dd>
                N {formatearNumero(bogota.norte, 0)} · E {formatearNumero(bogota.este, 0)}
              </dd>
            </div>
            {v.precisionM != null && <p className="text-stone-400 sm:col-span-3">Precisión del GPS ±{Math.round(v.precisionM)} m</p>}
          </dl>
        )}
        {listo && <MapaEstatico lat={v.lat!} lon={v.lon!} className="max-w-md" />}
        {listo && zona && (
          <p className="rounded bg-stone-50 px-2 py-1.5 text-[11px] leading-relaxed text-stone-600">
            {[zona.vereda && `Vereda ${zona.vereda}`, zona.municipio, zona.subzona_hidrografica && `Subzona ${zona.subzona_hidrografica}`].filter(Boolean).join(" · ") || "Fuera de las capas de la jurisdicción"}
            {(zona.areas_protegidas !== "Ninguna" || zona.aica !== "Ninguna" || zona.paramo !== "No" || zona.bosque_seco === "Sí") && (
              <span className="mt-0.5 block font-medium text-amber-800">
                {[zona.areas_protegidas !== "Ninguna" && `Área protegida: ${zona.areas_protegidas}`, zona.aica !== "Ninguna" && `AICA: ${zona.aica}`, zona.paramo !== "No" && `Páramo: ${zona.paramo}`, zona.bosque_seco === "Sí" && "Bosque seco tropical"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function CampoTabla({
  campo,
  valor,
  onCambio,
  soloLectura,
  falta,
}: {
  campo: Campo;
  valor: FilaTabla[];
  onCambio: (v: FilaTabla[]) => void;
  soloLectura: boolean;
  falta: boolean;
}) {
  const cols = campo.columnas ?? [];
  const filas = valor.length ? valor : soloLectura ? [] : [{}];
  const conTotal = cols.some((c) => c.total);
  const fijar = (i: number, col: string, x: string) => onCambio(filas.map((f, idx) => (idx === i ? { ...f, [col]: x } : f)));

  return (
    <div>
      <Etiqueta campo={campo} falta={falta} />
      <div className={`overflow-x-auto rounded-md border border-stone-200${falta ? " border-red-300" : ""}`}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50 text-left text-[11px] text-stone-600">
              <th className="w-6 px-1.5 py-1.5 font-medium">#</th>
              {cols.map((c) => (
                <th key={c.id} className="px-1.5 py-1.5 font-medium">
                  {c.titulo}
                </th>
              ))}
              {!soloLectura && <th className="w-6" />}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-t border-stone-100 align-top">
                <td className="px-1.5 py-1 text-stone-400">{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.id} className="px-1 py-1">
                    {c.tipo === "calculado" ? (
                      <span className="block min-w-[4.5rem] px-1 py-1 text-right font-medium text-stone-800">{formatearNumero(valorColumnaFila(campo, f, c.id), c.decimales ?? 2)}</span>
                    ) : c.tipo === "cumplimiento" ? (
                      <CeldaCumplimiento campo={campo} fila={f} col={c} soloLectura={soloLectura} onCambio={(x) => fijar(i, c.id, x)} />
                    ) : (
                      <input
                        value={f[c.id] ?? ""}
                        onChange={(e) => fijar(i, c.id, e.target.value)}
                        disabled={soloLectura}
                        inputMode={c.tipo === "numero" ? "decimal" : undefined}
                        className={`${celdaCls}${c.tipo === "numero" ? " text-right" : ""}`}
                      />
                    )}
                  </td>
                ))}
                {!soloLectura && (
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => onCambio(filas.filter((_, idx) => idx !== i))} aria-label={`Quitar fila ${i + 1}`} className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {conTotal && (
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50 font-semibold text-stone-800">
                <td className="px-1.5 py-1.5" />
                {cols.map((c, idx) => (
                  <td key={c.id} className="px-1.5 py-1.5 text-right">
                    {c.total ? formatearNumero(totalColumna(campo, filas, c.id), c.decimales ?? 2) : idx === 0 ? <span className="block text-left">Total</span> : ""}
                  </td>
                ))}
                {!soloLectura && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!soloLectura && (
        <button type="button" onClick={() => onCambio([...filas, {}])} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Agregar fila
        </button>
      )}
    </div>
  );
}

function CeldaCumplimiento({
  campo,
  fila,
  col,
  soloLectura,
  onCambio,
}: {
  campo: Campo;
  fila: FilaTabla;
  col: NonNullable<Campo["columnas"]>[number];
  soloLectura: boolean;
  onCambio: (v: string) => void;
}) {
  const auto = col.limite && col.resultado ? cumplimientoFila(campo, { ...fila, [col.id]: "" }, col) : null;
  if (auto) {
    return <span className={`block whitespace-nowrap rounded px-1.5 py-1 text-center text-[11px] font-semibold ${auto === "CUMPLE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{auto}</span>;
  }
  return (
    <select value={fila[col.id] ?? ""} onChange={(e) => onCambio(e.target.value)} disabled={soloLectura} className={celdaCls}>
      <option value="">—</option>
      {OPCIONES_CUMPLIMIENTO.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function CampoMultiple({ campo, valor, onCambio, soloLectura, falta }: { campo: Campo; valor: string; onCambio: (v: string) => void; soloLectura: boolean; falta: boolean }) {
  const items = valor.split("\n");
  const lista = items.length ? items : [""];
  const fijar = (nuevos: string[]) => onCambio(nuevos.join("\n"));
  const singular = campo.etiqueta.replace(/s?\s*\(.*\)$/, "").toLowerCase();
  return (
    <div>
      <Etiqueta campo={campo} falta={falta} />
      <div className="space-y-1.5">
        {lista.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              aria-label={`${campo.etiqueta} ${i + 1}`}
              value={it}
              onChange={(e) => fijar(lista.map((x, j) => (j === i ? e.target.value.replace(/\n/g, " ") : x)))}
              disabled={soloLectura}
              maxLength={300}
              className={campoCls + (falta ? " border-red-300 ring-1 ring-red-200" : "")}
            />
            {!soloLectura && lista.length > 1 && (
              <button type="button" onClick={() => fijar(lista.filter((_, j) => j !== i))} aria-label={`Quitar ${i + 1}`} className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        ))}
      </div>
      {!soloLectura && (
        <button type="button" onClick={() => fijar([...lista, ""])} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Agregar {singular}
        </button>
      )}
    </div>
  );
}
