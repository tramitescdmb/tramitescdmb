"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Hourglass, ImageOff, Map as MapaIcono, Plus, Shapes, Check } from "lucide-react";
import { ESTADOS_CDMB, calcularTablero, combinacionesReconocimientos, puntajesDelAnio, type FilaTableroNV, type VistaTablero } from "@/lib/negocios-verdes-tablero";
import { claseChipNV } from "@/components/negocios-verdes/TarjetaNegocio";

const PALETA = ["#038f67", "#01bd32", "#85c800", "#ff8623", "#2a6f97", "#8c8c7a", "#5e35b1", "#c17817"];
const num = (n: number, d = 1) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[12px] border border-nv-borde bg-white p-4 ${className}`}>{children}</div>;
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-7 text-[15px] font-medium tracking-[0.01em]">{children}</h2>;
}

function Kpi({ icono: Icono, valor, texto, color }: { icono: typeof Shapes; valor: number; texto: string; color: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-[12px] border border-nv-borde bg-white px-4 py-4 sm:w-[230px]">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: `${color}1f`, color }}>
        <Icono className="h-5 w-5" aria-hidden />
      </span>
      <span>
        <span className="block text-[22px] font-medium leading-tight">{valor.toLocaleString("es-CO")}</span>
        <span className="block text-[11.5px] leading-snug text-nv-texto2">{texto}</span>
      </span>
    </div>
  );
}

/** Barras verticales con la cifra encima y el rótulo inclinado debajo. */
function Barras({ datos }: { datos: [string, number][] }) {
  const max = Math.max(1, ...datos.map((d) => d[1]));
  const techo = Math.ceil(max * 1.19);
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(techo * f));
  const ancho = 1000;
  const alto = 260;
  const izq = 40;
  const base = 210;
  const paso = (ancho - izq - 10) / Math.max(1, datos.length);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto + 30}`} className="h-auto w-full" role="img" aria-label="Negocios por municipio">
      {marcas.map((m) => {
        const y = base - (m / techo) * 190;
        return (
          <g key={m}>
            <line x1={izq} x2={ancho} y1={y} y2={y} stroke="#e1e5df" />
            <text x={izq - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#1b2a20">
              {m}
            </text>
          </g>
        );
      })}
      {datos.map(([k, v], i) => {
        const h = (v / techo) * 190;
        const x = izq + paso * i + paso / 2;
        return (
          <g key={k}>
            <rect x={x - 8} y={base - h} width={16} height={h} rx={2} fill="#038f67" />
            <text x={x} y={base - h - 8} textAnchor="middle" fontSize="11" fill="#1b2a20">
              {v}
            </text>
            <text x={x} y={base + 16} textAnchor="end" fontSize="11" fill="#5b6b60" transform={`rotate(-30 ${x} ${base + 16})`}>
              {k}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Dona con porcentajes y leyenda al lado. */
function Dona({ datos }: { datos: [string, number][] }) {
  const total = datos.reduce((s, d) => s + d[1], 0);
  if (!total) return <p className="py-10 text-center text-sm text-nv-texto2">No hay datos con esta vista.</p>;
  const inicios = datos.map((_, i) => datos.slice(0, i).reduce((s, [, v]) => s + v, 0));
  const r = 86;
  const ri = 34;
  const arco = (a0: number, a1: number) => {
    const p = (a: number, rr: number) => [100 + rr * Math.cos(a - Math.PI / 2), 100 + rr * Math.sin(a - Math.PI / 2)];
    const g = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = p(a0, r);
    const [x1, y1] = p(a1, r);
    const [x2, y2] = p(a1, ri);
    const [x3, y3] = p(a0, ri);
    return `M${x0} ${y0} A${r} ${r} 0 ${g} 1 ${x1} ${y1} L${x2} ${y2} A${ri} ${ri} 0 ${g} 0 ${x3} ${y3} Z`;
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-4">
      <svg viewBox="0 0 200 200" className="h-[180px] w-[180px]" role="img" aria-label="Distribución">
        {datos.map(([k, v], i) => {
          const a0 = (inicios[i] / total) * Math.PI * 2;
          const a1 = ((inicios[i] + v) / total) * Math.PI * 2 - (datos.length === 1 ? 0.0001 : 0);
          const medio = (a0 + a1) / 2;
          const pct = Math.round((v / total) * 100);
          return (
            <g key={k}>
              <path d={arco(a0, a1)} fill={PALETA[i % PALETA.length]} stroke="#fff" strokeWidth="1.5" />
              {pct >= 5 && (
                <text x={100 + 62 * Math.cos(medio - Math.PI / 2)} y={104 + 62 * Math.sin(medio - Math.PI / 2)} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">
                  {pct}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="space-y-1.5 text-[11.5px] text-nv-texto2">
        {datos.map(([k, v], i) => (
          <li key={k} className="flex max-w-[190px] items-start gap-2">
            <span className="mt-0.5 h-2.5 w-2.5 flex-none rounded-sm" style={{ background: PALETA[i % PALETA.length] }} aria-hidden />
            {k} ({v})
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Línea del puntaje promedio por año (área sombreada, cifra sobre cada punto y negocios debajo). */
function Linea({ datos }: { datos: { anio: number; promedio: number; negocios: number }[] }) {
  if (!datos.length) return <p className="py-10 text-center text-sm text-nv-texto2">No hay puntajes con esta vista.</p>;
  const ancho = 1000;
  const izq = 50;
  const der = 30;
  const y = (v: number) => 230 - (v / 100) * 210;
  const x = (i: number) => (datos.length === 1 ? (ancho + izq) / 2 : izq + 50 + (i * (ancho - izq - der - 100)) / (datos.length - 1));
  const camino = datos.map((d, i) => `${i ? "L" : "M"}${x(i)} ${y(d.promedio)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${ancho} 280`} className="h-auto w-full" role="img" aria-label="Puntaje promedio por año">
      {[0, 25, 50, 75, 100].map((m) => (
        <g key={m}>
          <line x1={izq} x2={ancho} y1={y(m)} y2={y(m)} stroke="#e1e5df" />
          <text x={izq - 14} y={y(m) + 4} textAnchor="end" fontSize="12" fill="#1b2a20">
            {m}
          </text>
        </g>
      ))}
      <path d={`${camino} L${x(datos.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="#dceee6" opacity="0.8" />
      <path d={camino} fill="none" stroke="#038f67" strokeWidth="2.5" />
      {datos.map((d, i) => (
        <g key={d.anio}>
          <circle cx={x(i)} cy={y(d.promedio)} r="4" fill="#038f67" />
          <text x={x(i)} y={y(d.promedio) - 14} textAnchor="middle" fontSize="11" fill="#1b2a20">
            {num(d.promedio)}
          </text>
          <text x={x(i)} y={250} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1b2a20">
            {d.anio}
          </text>
          <text x={x(i)} y={266} textAnchor="middle" fontSize="9.5" fill="#5b6b60">
            {d.negocios} negocios
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Panel del administrador: «Hola de nuevo», vistas, cifras y gráficas como en la plataforma anterior. */
export function TableroNV({ filas, puedeCrear }: { filas: FilaTableroNV[]; puedeCrear: boolean }) {
  const [vista, setVista] = useState<VistaTablero>({ tipo: "global" });
  const [menuEstado, setMenuEstado] = useState(false);
  const [anioSel, setAnioSel] = useState<number | null>(null);
  const [completo, setCompleto] = useState(false);
  const t = useMemo(() => calcularTablero(filas, vista), [filas, vista]);
  const anios = t.porAnio.map((a) => a.anio).sort((a, b) => b - a);
  const anio = anioSel && anios.includes(anioSel) ? anioSel : anios[0];
  const p = anio ? puntajesDelAnio(t.filas, anio) : null;
  const etiquetaVista =
    vista.tipo === "global" ? "Global" : vista.tipo === "estado" ? vista.estado ?? "Todos los estados" : vista.tipo === "emprendimiento" ? "Emprendimiento Verde" : vista.tipo === "sello" ? "Sello Marca" : "Avalado";
  const chip = (activo: boolean, texto: string, alClic: () => void) => (
    <button type="button" onClick={alClic} aria-pressed={activo} className={claseChipNV(activo)}>
      {activo && <Check className="h-4 w-4" aria-hidden />}
      {texto}
    </button>
  );
  const maxCombo = filas.length || 1;
  const medallas = ["🥇", "🥈", "🥉"];

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[22px] font-normal">Hola de nuevo</p>
          <p className="text-[13px] text-nv-texto2">{filas.length.toLocaleString("es-CO")} negocios registrados en total</p>
        </div>
        {puedeCrear && (
          <Link prefetch={false} href="/negocios-verdes/admin/negocios/nuevo" className="inline-flex items-center gap-2 rounded-[8px] bg-nv-acento px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nv-acento-oscuro">
            <Plus className="h-4 w-4" aria-hidden /> Nuevo negocio
          </Link>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {chip(vista.tipo === "global", "Global", () => setVista({ tipo: "global" }))}
        <div className="relative">
          <button type="button" onClick={() => setMenuEstado((v) => !v)} aria-expanded={menuEstado} className={`${claseChipNV(vista.tipo === "estado")} min-h-[38px] rounded-[14px]`}>
            {vista.tipo === "estado" && <Check className="h-4 w-4" aria-hidden />}
            {vista.tipo === "estado" ? etiquetaVista : "Estado CDMB"} <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
          {menuEstado && (
            <ul className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-[8px] border border-nv-borde bg-white py-1 text-sm shadow-lg">
              {[null, ...ESTADOS_CDMB].map((e) => (
                <li key={e ?? "todos"}>
                  <button type="button" onClick={() => { setVista({ tipo: "estado", estado: e }); setMenuEstado(false); }} className="w-full px-4 py-2 text-left hover:bg-nv-claro">
                    {e ?? "Todos los estados"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {chip(vista.tipo === "emprendimiento", "Emprendimiento Verde", () => setVista({ tipo: "emprendimiento" }))}
        {chip(vista.tipo === "sello", "Sello Marca", () => setVista({ tipo: "sello" }))}
        {chip(vista.tipo === "avalado", "Avalado", () => setVista({ tipo: "avalado" }))}
      </div>
      <p className="mt-4 text-[13.5px] font-semibold text-nv-oscuro">
        Vista: {etiquetaVista} · {t.filas.length} negocios
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        <Kpi icono={CheckCircle2} valor={t.publicados} texto="Publicados en el sitio" color="#038f67" />
        <Kpi icono={Hourglass} valor={t.faltanPublicar} texto="CDMB los marca ACTIVO, faltan publicar" color="#cc6b1c" />
        <Kpi icono={ImageOff} valor={t.sinFoto} texto="Sin foto de portada" color="#c0392b" />
        <Kpi icono={Shapes} valor={t.sinClasificar} texto="Sin categoría clasificada" color="#c0392b" />
        <Kpi icono={MapaIcono} valor={t.porMunicipio.length} texto="Municipios con negocios" color="#01bd32" />
      </div>

      <Titulo>Negocios por municipio</Titulo>
      <Tarjeta>{t.porMunicipio.length ? <Barras datos={t.porMunicipio} /> : <p className="py-10 text-center text-sm text-nv-texto2">No hay datos con esta vista.</p>}</Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Titulo>Por categoría oficial</Titulo>
          <Tarjeta>
            <Dona datos={t.porCategoria} />
          </Tarjeta>
        </div>
        <div>
          <Titulo>{t.segundaTorta.titulo}</Titulo>
          <Tarjeta>
            <Dona datos={t.segundaTorta.datos} />
          </Tarjeta>
        </div>
      </div>

      <Titulo>Puntaje de seguimiento promedio por año</Titulo>
      <p className="-mt-1 mb-2 text-[11.5px] text-nv-texto2">
        Solo cuenta los negocios calificados ese año: los que no existían o no se evaluaron (puntaje 0 o vacío) no entran al promedio. Debajo de cada año, cuántos negocios se promediaron.
      </p>
      <Tarjeta>
        <Linea datos={t.porAnio} />
      </Tarjeta>

      {p && anio && (
        <>
          <Titulo>Puntajes por año</Titulo>
          <div className="flex flex-wrap gap-2">
            {anios.map((a) => (
              <span key={a}>{chip(a === anio, String(a), () => setAnioSel(a))}</span>
            ))}
          </div>
          <p className="mt-3 text-[13.5px] font-semibold text-nv-oscuro">
            {anio}: promedio {num(p.promedio)} de {p.negocios} negocios calificados
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <Tarjeta className="self-start">
              <p className="mb-2 text-[13.5px] font-semibold">Mejores puntajes {anio}</p>
              <ol>
                {(completo ? p.delAnio : p.delAnio.slice(0, 10)).map((x, i) => (
                  <li key={x.id} className="flex items-center gap-3 py-2">
                    <span className="w-6 text-center text-[13px]">{medallas[i] ?? i + 1}</span>
                    <Link prefetch={false} href={`/negocios-verdes/admin/negocios/${x.id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate text-[13px] uppercase tracking-[0.02em]">{x.nombre}</span>
                      <span className="block text-[11px] text-nv-texto2">{x.municipio}</span>
                    </Link>
                    <span className="text-[13px] font-semibold text-nv-vivo">{num(x.puntaje)}</span>
                  </li>
                ))}
              </ol>
              {p.delAnio.length > 10 && (
                <button type="button" onClick={() => setCompleto((v) => !v)} className="mt-1 px-3 py-1.5 text-[13px] font-semibold text-nv-vivo hover:underline">
                  {completo ? "Ver solo los 10 mejores" : `Ver los ${p.delAnio.length} negocios calificados`}
                </button>
              )}
            </Tarjeta>
            <Tarjeta className="self-start">
              <p className="mb-2 text-[13.5px] font-semibold">Promedio por municipio {anio}</p>
              <ul>
                {p.porMunicipio.map((m) => (
                  <li key={m.municipio} className="py-1.5">
                    <div className="flex items-baseline gap-1 text-[13px]">
                      <span className="flex-1">{m.municipio}</span>
                      <span className="font-semibold">{num(m.promedio)}</span>
                      <span className="text-[11px] text-nv-texto2">· {m.negocios} negocios</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-nv-fondo">
                      <div className="h-2 rounded-full bg-nv-vivo" style={{ width: `${Math.min(100, m.promedio)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>
        </>
      )}

      {vista.tipo === "global" && (
        <>
          <Titulo>Combinaciones de reconocimientos</Titulo>
          <p className="-mt-1 mb-2 text-[11.5px] text-nv-texto2">Los 3 reconocimientos son independientes: un negocio puede tener 1, 2 o los 3.</p>
          <Tarjeta>
            <ul>
              {combinacionesReconocimientos(filas).map(([k, v]) => (
                <li key={k} className="py-2">
                  <div className="flex justify-between text-[13px]">
                    <span className={v === 0 ? "text-nv-texto2" : ""}>{k}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-nv-fondo">
                    <div className="h-2 rounded-full bg-nv-primario" style={{ width: `${(v / maxCombo) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
