import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Info, type LucideIcon } from "lucide-react";

const TONOS = {
  cdmb: "text-cdmb-600",
  acento: "text-acento-600",
  ambar: "text-amber-600",
  cielo: "text-sky-600",
  rojo: "text-red-600",
  verde: "text-emerald-600",
  violeta: "text-violet-600",
  neutro: "text-stone-500",
} as const;

const MOSAICOS = {
  cdmb: "bg-cdmb-500 text-white",
  acento: "bg-acento-400 text-stone-900",
  ambar: "bg-amber-300 text-stone-900",
  cielo: "bg-sky-200 text-sky-950",
  rojo: "bg-red-300 text-red-950",
  verde: "bg-emerald-300 text-emerald-950",
  violeta: "bg-violet-200 text-violet-950",
  neutro: "bg-stone-200 text-stone-800",
} as const;

export type TonoTablero = keyof typeof TONOS;

export function Burbuja({ icon: Icon, tono = "cdmb", tamano = "md" }: { icon: LucideIcon; tono?: TonoTablero; tamano?: "sm" | "md" | "lg" }) {
  const caja = { sm: "h-5 w-5", md: "h-6 w-6", lg: "h-7 w-7" }[tamano];
  const icono = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" }[tamano];
  return (
    <span className={`flex ${caja} flex-none items-center justify-center ${TONOS[tono]}`}>
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
  const Icon = icon;
  const contenido = (
    <>
      <span className="min-w-0">
        <span className="block text-xl font-semibold leading-tight tabular-nums">
          {typeof valor === "number" ? valor.toLocaleString("es-CO") : valor}
        </span>
        <span className="block text-[13px] leading-snug opacity-90">{etiqueta}</span>
        {detalle && <span className="block text-[11px] leading-tight opacity-75">{detalle}</span>}
      </span>
      <Icon className="h-6 w-6 flex-none opacity-80" aria-hidden />
    </>
  );
  const clase = `flex min-h-[4.25rem] min-w-[9.5rem] items-start justify-between gap-3 rounded px-3 py-2.5 ${MOSAICOS[alerta ? "rojo" : tono]}`;
  return href ? (
    <Link href={href} title={titulo} className={`${clase} transition hover:brightness-95`}>
      {contenido}
    </Link>
  ) : (
    <div title={titulo} className={clase}>
      {contenido}
    </div>
  );
}

function Contador({ valor }: { valor: number }) {
  return <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-sky-800">{valor.toLocaleString("es-CO")}</span>;
}

const LARGO_DESCRIPCION = 90;

function esLarga(descripcion: ReactNode): descripcion is string {
  return typeof descripcion === "string" && descripcion.length > LARGO_DESCRIPCION;
}

function IconoAyuda({ texto }: { texto: string }) {
  return (
    <span title={texto} aria-label={texto} className="inline-flex cursor-help text-stone-400 hover:text-cdmb-600">
      <Info className="h-4 w-4" aria-hidden />
    </span>
  );
}

export function BandaTablero({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <header className={`rounded-md border border-stone-200 bg-white px-5 py-4 ${className}`}>{children}</header>
  );
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
    <BandaTablero>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <Burbuja icon={icon} tono={tono} tamano="lg" />}
          <div className="min-w-0">
            {antetitulo && <p className="text-xs text-stone-500">{antetitulo}</p>}
            <h2 className="mt-0.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
              {titulo}
              {contador !== undefined && <Contador valor={contador} />}
              {esLarga(descripcion) && <IconoAyuda texto={descripcion} />}
            </h2>
            {descripcion && !esLarga(descripcion) && <div className="mt-0.5 text-sm text-stone-500">{descripcion}</div>}
          </div>
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">{acciones}</div> : children && <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{children}</div>}
      </div>
      {acciones && children && <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{children}</div>}
    </BandaTablero>
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
  id,
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
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`flex scroll-mt-20 flex-col overflow-hidden rounded-md border border-stone-200 bg-white ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <Burbuja icon={icon} tono={tono} />}
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              {titulo}
              {contador !== undefined && (
                <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-sky-800">{contador.toLocaleString("es-CO")}</span>
              )}
              {esLarga(descripcion) && <IconoAyuda texto={descripcion} />}
            </h2>
            {descripcion && !esLarga(descripcion) && <p className="text-xs text-stone-500">{descripcion}</p>}
          </div>
        </div>
        {accion && <div className="flex-none text-xs">{accion}</div>}
      </div>
      <div className={sinRelleno ? "flex-1" : "flex-1 px-5 py-4"}>{children}</div>
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
      {barra && <span className={`absolute inset-y-0 left-0 w-[3px] ${barra}`} aria-hidden />}
      {icon && <Burbuja icon={icon} tono={tono} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-stone-800">{titulo}</span>
        {detalle && <span className="block truncate text-xs text-stone-400">{detalle}</span>}
      </span>
      {extra && <span className="flex flex-none items-center gap-2">{extra}</span>}
      {href && <ChevronRight className="h-4 w-4 flex-none text-stone-300 group-hover:text-cdmb-600" aria-hidden />}
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
  return <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${clase}`}>{children}</span>;
}

export function PieTablero({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-4 py-2.5 text-xs text-stone-500">
      {children}
    </div>
  );
}
