import Link from "next/link";
import { Building2, User, MapPin, Phone, Smartphone, Mail, Home, ReceiptText, BadgeCheck } from "lucide-react";

export type VinculacionNit = {
  nroSolicitud: number | null;
  fechaDesde: string;
  fechaHasta: string;
  tieneDetalle: boolean;
};

export type EntidadNit = {
  clave: string;
  identificacion: string;
  nombre: string;
  tipoLabel: string | null;
  tipoValue: "N" | "C" | null;
  regimen: string | null;
  granContribuyente: string | null;
  autorretenedor: string | null;
  direccion: string | null;
  telefono: string | null;
  celular: string | null;
  correo: string | null;
  municipio: string | null;
  departamento: string | null;
  actualizado: string | null;
  actualizadoPor: string | null;
  vinculaciones: VinculacionNit[];
};

function Dato({ icono: Icono, etiqueta, valor }: { icono: React.ComponentType<{ className?: string }>; etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex items-start gap-2">
      <Icono className="mt-0.5 h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-stone-400">{etiqueta}</p>
        <p className="truncate text-stone-700" title={valor}>
          {valor}
        </p>
      </div>
    </div>
  );
}

function TarjetaNit({ e }: { e: EntidadNit }) {
  const Icono = e.tipoValue === "C" ? User : Building2;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Icono className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-stone-900" title={e.nombre}>
              {e.nombre}
            </p>
            <p className="text-xs text-stone-500">
              {e.tipoLabel ?? "Identificación"} · <span className="font-medium text-stone-700">{e.identificacion}</span>
            </p>
          </div>
        </div>
        {e.regimen && (
          <span className="flex-none rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{e.regimen}</span>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-x-4 gap-y-2.5 border-t border-stone-100 pt-3.5 text-sm sm:grid-cols-2">
        <Dato icono={MapPin} etiqueta="Municipio" valor={[e.municipio, e.departamento].filter(Boolean).join(", ") || null} />
        <Dato icono={Home} etiqueta="Dirección" valor={e.direccion} />
        <Dato icono={Phone} etiqueta="Teléfono" valor={e.telefono} />
        <Dato icono={Smartphone} etiqueta="Celular" valor={e.celular} />
        <Dato icono={Mail} etiqueta="Correo" valor={e.correo} />
        <Dato icono={BadgeCheck} etiqueta="Gran contribuyente" valor={e.granContribuyente} />
        <Dato icono={ReceiptText} etiqueta="Autorretenedor" valor={e.autorretenedor} />
      </div>

      <div className="mt-3.5 border-t border-stone-100 pt-3">
        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-400">
          Solicitudes vinculadas ({e.vinculaciones.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {e.vinculaciones.map((v, i) =>
            v.nroSolicitud && v.tieneDetalle ? (
              <Link
                key={`${v.nroSolicitud}-${i}`}
                href={`/historico/solicitudes/${v.nroSolicitud}`}
                title={v.fechaDesde || undefined}
                className="rounded-full border border-cdmb-200 bg-cdmb-50 px-2.5 py-1 text-xs font-medium text-cdmb-800 hover:bg-cdmb-100"
              >
                {v.nroSolicitud}
              </Link>
            ) : (
              <span
                key={`${v.nroSolicitud ?? "s"}-${i}`}
                title={v.fechaDesde ? `${v.fechaDesde} — sin resolución de fondo en el histórico` : undefined}
                className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-500"
              >
                {v.nroSolicitud ?? "—"}
              </span>
            )
          )}
        </div>
      </div>

      {(e.actualizado || e.actualizadoPor) && (
        <p className="mt-3 text-xs text-stone-400">
          Actualizado en SINCA 1.0{e.actualizado ? ` el ${e.actualizado}` : ""}
          {e.actualizadoPor ? ` por ${e.actualizadoPor}` : ""}.
        </p>
      )}
    </div>
  );
}

/** Tarjetas del registro de terceros de SINCA 1.0 — una por NIT/cédula distinto, con sus solicitudes agrupadas. */
export function TarjetasNit({ entidades, sinResultadosTexto }: { entidades: EntidadNit[]; sinResultadosTexto: string }) {
  if (entidades.length === 0) {
    return <p className="rounded-xl border border-stone-200 bg-white px-5 py-10 text-center text-sm text-stone-400">{sinResultadosTexto}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {entidades.map((e) => (
        <TarjetaNit key={e.clave} e={e} />
      ))}
    </div>
  );
}
