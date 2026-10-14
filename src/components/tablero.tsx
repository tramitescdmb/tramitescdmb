import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

const TONOS = {
  cdmb: "bg-cdmb-100 text-cdmb-700",
  acento: "bg-acento-100 text-acento-700",
  ambar: "bg-amber-100 text-amber-700",
  cielo: "bg-sky-100 text-sky-700",
  rojo: "bg-red-100 text-red-700",
  verde: "bg-emerald-100 text-emerald-700",
  violeta: "bg-violet-100 text-violet-700",
  neutro: "bg-stone-100 text-stone-500",
} as const;

export type TonoTablero = keyof typeof TONOS;

export function Burbuja({ icon: Icon, tono = "cdmb", tamano = "md" }: { icon: LucideIcon; tono?: TonoTablero; tamano?: "sm" | "md" | "lg" }) {
  const caja = { sm: "h-7 w-7", md: "h-8 w-8", lg: "h-9 w-9" }[tamano];
  const icono = tamano === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span className={`flex ${caja} flex-none items-center justify-center rounded-full ${TONOS[tono]}`}>
      <Icon className={icono} aria-hidden />
    </span>
  );
}

export function Indicador({
  icon,
  valor,
  etiqueta,
  tono = "cdmb",
  href,
  detalle,
  titulo,
  alerta,
}: {
  icon: LucideIcon;
  valor: ReactNode;
  etiqueta: string;
  tono?: TonoTablero;
  href?: string;
  detalle?: string;
  titulo?: string;
  alerta?: boolean;
}) {
  const contenido = (
    <>
      <Burbuja icon={icon} tono={tono} tamano="lg" />
      <span className="min-w-0">
        <span className={`block text-lg font-semibold leading-none tabular-nums ${alerta ? "text-red-600" : "text-stone-900"}`}>
          {typeof valor === "number" ? valor.toLocaleString("es-CO") : valor}
        </span>
        <span className="block text-xs text-stone-500">{etiqueta}</span>
        {detalle && <span className="block text-[10px] leading-tight text-stone-400">{detalle}</span>}
      </span>
    </>
  );
  const clase = "flex items-center gap-3 rounded-xl bg-white/80 px-4 py-2.5 ring-1 ring-stone-200/70 backdrop-blur";
  return href ? (
    <Link href={href} title={titulo} className={`${clase} transition hover:bg-white hover:ring-cdmb-300`}>
      {contenido}
    </Link>
  ) : (
    <div title={titulo} className={clase}>
      {contenido}
    </div>
  );
}

function Contador({ valor }: { valor: number }) {
  return <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-500 ring-1 ring-stone-200/70">{valor.toLocaleString("es-CO")}</span>;
}

export function CabeceraTablero({
  icon,
  tono = "cdmb",
  antetitulo,
  titulo,
  contador,
  descripcion,
  acciones,
  children,
}: {
  icon?: LucideIcon;
  tono?: TonoTablero;
  antetitulo?: ReactNode;
  titulo: ReactNode;
  contador?: number;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="rounded-2xl border border-cdmb-100 bg-gradient-to-br from-cdmb-50 via-white to-acento-50/60 px-5 py-4 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <Burbuja icon={icon} tono={tono} tamano="lg" />}
          <div className="min-w-0">
            {antetitulo && <p className="text-xs font-medium uppercase tracking-wide text-cdmb-700">{antetitulo}</p>}
            <h2 className="mt-0.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
              {titulo}
              {contador !== undefined && <Contador valor={contador} />}
            </h2>
            {descripcion && <div className="mt-0.5 text-sm text-stone-500">{descripcion}</div>}
          </div>
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : children && <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{children}</div>}
      </div>
      {acciones && children && <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{children}</div>}
    </header>
  );
}

export function TarjetaTablero({
  icon,
  tono = "cdmb",
  titulo,
  descripcion,
  contador,
  accion,
  sinRelleno,
  className = "",
  children,
}: {
  icon?: LucideIcon;
  tono?: TonoTablero;
  titulo: ReactNode;
  descripcion?: ReactNode;
  contador?: number;
  accion?: ReactNode;
  sinRelleno?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <Burbuja icon={icon} tono={tono} />}
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              {titulo}
              {contador !== undefined && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-500">{contador.toLocaleString("es-CO")}</span>
              )}
            </h2>
            {descripcion && <p className="text-xs text-stone-500">{descripcion}</p>}
          </div>
        </div>
        {accion && <div className="flex-none text-xs">{accion}</div>}
      </div>
      <div className={sinRelleno ? "flex-1 border-t border-stone-100" : "flex-1 px-5 pb-5"}>{children}</div>
    </section>
  );
}

export function EnlaceTablero({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-medium text-cdmb-700 hover:underline">
      {children}
      <ArrowRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}

export function FilaTablero({
  href,
  icon,
  tono = "cdmb",
  titulo,
  detalle,
  extra,
  barra,
}: {
  href?: string;
  icon?: LucideIcon;
  tono?: TonoTablero;
  titulo: ReactNode;
  detalle?: ReactNode;
  extra?: ReactNode;
  barra?: string;
}) {
  const contenido = (
    <>
      {barra && <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${barra}`} aria-hidden />}
      {icon && <Burbuja icon={icon} tono={tono} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-stone-800">{titulo}</span>
        {detalle && <span className="block truncate text-xs text-stone-400">{detalle}</span>}
      </span>
      {extra && <span className="flex flex-none items-center gap-2">{extra}</span>}
      {href && <ArrowRight className="h-3.5 w-3.5 flex-none text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-cdmb-600" aria-hidden />}
    </>
  );
  const clase = "relative flex items-center gap-3 px-5 py-2.5 text-sm";
  return (
    <li>
      {href ? (
        <Link href={href} className={`group ${clase} hover:bg-stone-50`}>
          {contenido}
        </Link>
      ) : (
        <div className={clase}>{contenido}</div>
      )}
    </li>
  );
}

export function ListaTablero({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-stone-100">{children}</ul>;
}

export function VacioTablero({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-stone-400">{children}</p>;
}

export function Chip({ tono = "neutro", children }: { tono?: TonoTablero; children: ReactNode }) {
  const clase = {
    cdmb: "bg-cdmb-50 text-cdmb-700",
    acento: "bg-acento-50 text-acento-700",
    ambar: "bg-amber-50 text-amber-700",
    cielo: "bg-sky-50 text-sky-700",
    rojo: "bg-red-50 text-red-700",
    verde: "bg-emerald-50 text-emerald-700",
    violeta: "bg-violet-50 text-violet-700",
    neutro: "bg-stone-100 text-stone-600",
  }[tono];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${clase}`}>{children}</span>;
}

export function PieTablero({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/70 px-4 py-2.5 text-xs text-stone-500">
      {children}
    </div>
  );
}
