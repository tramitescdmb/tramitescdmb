import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Burbuja, CabeceraTablero, Indicador, type TonoTablero } from "@/components/tablero";

export function TituloSeccion({
  icon,
  children,
  contador,
  accion,
  descripcion,
  variante = "pagina",
}: {
  icon?: LucideIcon;
  children: ReactNode;
  contador?: number;
  accion?: ReactNode;
  descripcion?: ReactNode;
  variante?: "pagina" | "seccion";
}) {
  if (variante === "pagina") {
    return <CabeceraTablero icon={icon} titulo={children} contador={contador} descripcion={descripcion} acciones={accion ? <div className="text-xs">{accion}</div> : undefined} />;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-stone-900">
        {icon && <Burbuja icon={icon} />}
        {children}
        {contador !== undefined && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-500">{contador.toLocaleString("es-CO")}</span>
        )}
      </h2>
      {accion && <div className="text-xs">{accion}</div>}
    </div>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-stone-900">{children}</h3>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-soft ${className}`}>{children}</div>;
}

export function EstadoVacio({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-400 shadow-soft">
      {Icon && <Icon className="mx-auto mb-2 h-6 w-6 text-stone-300" aria-hidden />}
      {children}
    </div>
  );
}

const TONOS_KPI = {
  neutro: "neutro",
  cdmb: "cdmb",
  azul: "cielo",
  ambar: "ambar",
  cian: "cielo",
  rojo: "rojo",
  verde: "verde",
} as const satisfies Record<string, TonoTablero>;

export type TonoKpi = keyof typeof TONOS_KPI;

export function TarjetaKpi({
  icon,
  label,
  value,
  tono = "neutro",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tono?: TonoKpi;
  href?: string;
}) {
  return <Indicador icon={icon} etiqueta={label} valor={value} tono={TONOS_KPI[tono]} href={href} alerta={tono === "rojo" && value > 0} />;
}

export function Esqueleto({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-stone-200/70 ${className}`} />;
}

export function EsqueletoTitulo() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cdmb-100 bg-gradient-to-br from-cdmb-50 via-white to-acento-50/60 px-5 py-4 shadow-soft">
      <Esqueleto className="h-9 w-9 rounded-full" />
      <div className="space-y-1.5">
        <Esqueleto className="h-5 w-56" />
        <Esqueleto className="h-3 w-40" />
      </div>
    </div>
  );
}

export function EsqueletoTablero({ tarjetas = 4 }: { tarjetas?: number }) {
  return (
    <div className="space-y-4">
      <EsqueletoTitulo />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: tarjetas }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-stone-100 bg-white p-4 shadow-soft">
            <Esqueleto className="h-3 w-20" />
            <Esqueleto className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-soft">
        <Esqueleto className="mb-3 h-4 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Esqueleto key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EsqueletoLista({ filas = 8 }: { filas?: number }) {
  return (
    <div className="space-y-4">
      <EsqueletoTitulo />
      <Esqueleto className="h-9 w-full max-w-md" />
      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-soft">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Esqueleto className="h-4 flex-1" />
            <Esqueleto className="h-4 w-20" />
            <Esqueleto className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoDetalle() {
  return (
    <div className="space-y-4">
      <EsqueletoTitulo />
      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <Esqueleto className="h-4 w-2/3" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Esqueleto key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <Esqueleto className="mb-3 h-4 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Esqueleto key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EsqueletoFormulario({ campos = 5 }: { campos?: number }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <EsqueletoTitulo />
      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        {Array.from({ length: campos }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Esqueleto className="h-3 w-32" />
            <Esqueleto className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
