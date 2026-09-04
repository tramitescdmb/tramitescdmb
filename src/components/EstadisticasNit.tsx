"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, XCircle, PieChart, ClipboardList } from "lucide-react";

type Estadisticas = {
  totalTerceros: number;
  conVinculacion: number;
  sinVinculacion: number;
  porcentajeSinVinculacion: number;
  totalVinculaciones: number;
  calculadoEn: string;
};

const num = (v: number) => v.toLocaleString("es-CO");
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const clases = `rounded-xl border border-stone-200 bg-white p-3 ${href ? "block transition-colors hover:border-cdmb-300 hover:bg-cdmb-50/40" : ""}`;
  const contenido = (
    <>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
        <Icon className="h-3.5 w-3.5 text-stone-400" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-tight text-stone-900">{value}</p>
      {hint && <p className="text-[10px] text-stone-400">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className={clases}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

/**
 * Estadísticas sobre el registro COMPLETO de NIT/terceros (no solo lo que muestra el
 * filtro actual) — pensadas para evaluar más adelante si conviene depurar los terceros
 * que nunca han quedado vinculados a una solicitud con detalle disponible. Se calculan
 * aparte (ruta /api/historico/nits/estadisticas, con caché de varias horas porque
 * recorrer las ~33 mil filas del API toma cerca de 20 segundos) para no demorar la
 * carga del listado principal.
 */
export function EstadisticasNit() {
  const [datos, setDatos] = useState<Estadisticas | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/historico/nits/estadisticas")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: Estadisticas) => {
        if (!cancelado) setDatos(d);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-900">Estadísticas del registro completo</h3>
      <p className="mb-3 text-xs text-stone-500">Terceros distintos en todo SINCA 1.0, con o sin ninguna solicitud vinculada.</p>

      {error ? (
        <p className="text-sm text-stone-400">No se pudieron calcular las estadísticas. Intente de nuevo más tarde.</p>
      ) : !datos ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Calculando estadísticas…">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-xl border border-stone-200 bg-stone-50" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Kpi icon={Building2} label="Total de terceros" value={num(datos.totalTerceros)} href="/historico/nits" />
            <Kpi
              icon={CheckCircle2}
              label="Con al menos 1 vinculada"
              value={num(datos.conVinculacion)}
              href="/historico/nits?vinculadas=1"
            />
            <Kpi
              icon={XCircle}
              label="Sin ninguna vinculada"
              value={num(datos.sinVinculacion)}
              hint="Candidatos a revisar para depurar"
              href="/historico/nits?vinculadas=0"
            />
            <Kpi icon={PieChart} label="% sin ninguna vinculada" value={`${(datos.porcentajeSinVinculacion * 100).toFixed(1)} %`} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-400">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Calculado el {fechaHora(datos.calculadoEn)} — se recalcula automáticamente cada varias horas.
          </p>
        </>
      )}
    </section>
  );
}
