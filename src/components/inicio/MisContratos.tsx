import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, Check, CheckCircle2, PenLine, Search } from "lucide-react";
import type { ContratoLanding, EstadoContrato, PeriodoLanding, SeguimientoContratos as DatosSeguimiento } from "@/lib/contratos-landing";
import { formatearPesosCO } from "@/lib/moneda";

const CLASE_ESTADO: Record<EstadoContrato, string> = {
  "En ejecución": "bg-emerald-50 text-emerald-700",
  "Por iniciar": "bg-sky-50 text-sky-700",
  "Plazo vencido": "bg-red-50 text-red-700",
  "En liquidación": "bg-violet-50 text-violet-700",
};

function fecha(d: Date | null) {
  return d ? d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
}

function fechaCorta(d: Date) {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{etiqueta}</dt>
      <dd className="truncate text-xs text-stone-800">{children}</dd>
    </div>
  );
}

function LineaInformes({ periodos }: { periodos: PeriodoLanding[] }) {
  return (
    <ol className="flex">
      {periodos.map((p, i) => {
        const punto = {
          radicado: "bg-emerald-500 text-white",
          pendiente: "bg-acento-500 text-white ring-2 ring-acento-100",
          "en-curso": "bg-white text-sky-600 ring-2 ring-sky-300",
          futuro: "bg-stone-200 text-stone-400",
        }[p.estado];
        const texto = {
          radicado: "Radicado",
          pendiente: p.diasDeRetraso > 0 ? `${p.diasDeRetraso} d de retraso` : "Por radicar",
          "en-curso": "En curso",
          futuro: `Desde ${fechaCorta(p.radicaDesde)}`,
        }[p.estado];
        const contenido = (
          <>
            <span className="relative flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : p.estado === "futuro" ? "bg-stone-200" : "bg-emerald-300"}`} />
              <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full ${punto}`}>
                {p.estado === "radicado" ? <Check className="h-3 w-3" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={`h-0.5 flex-1 ${i === periodos.length - 1 ? "bg-transparent" : periodos[i + 1]!.estado === "futuro" ? "bg-stone-200" : "bg-emerald-300"}`} />
            </span>
            <span className={`mt-0.5 text-[11px] font-semibold capitalize ${p.estado === "futuro" ? "text-stone-400" : "text-stone-800"}`}>{p.mes}</span>
            <span className={`text-[10px] ${p.estado === "pendiente" ? "font-medium text-acento-700" : "text-stone-400"}`}>{texto}</span>
          </>
        );
        return (
          <li key={p.clave} className="flex min-w-0 flex-1 flex-col items-center text-center" title={`Informe ${p.rango}`}>
            {p.link ? (
              <Link href={p.link} className="flex w-full flex-col items-center rounded-md pb-0.5 hover:bg-stone-50">
                {contenido}
              </Link>
            ) : (
              <span className="flex w-full flex-col items-center pb-0.5">{contenido}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TarjetaContrato({ c }: { c: ContratoLanding }) {
  const radicados = c.periodos.filter((p) => p.estado === "radicado").length;
  const firmasListas = c.firmas.filter((f) => f.puedeActuar).length;
  const valorTotal = c.valorInicial !== null ? c.valorInicial + c.valorAdicionado : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
              <span className={`rounded-full px-2 py-px font-semibold ${CLASE_ESTADO[c.estado]}`}>{c.estado}</span>
              {c.relacion === "SUPERVISOR" && <span className="rounded-full bg-sky-50 px-2 py-px font-semibold text-sky-700">Supervisión</span>}
              Expediente {c.numero}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-stone-900">
              {c.codigoProceso && <span className="mr-1.5 font-mono">{c.codigoProceso}</span>}
              Contrato N.° {c.numeroContrato ?? "sin número"}
            </h3>
            <p className="line-clamp-2 text-xs text-stone-500" title={c.objeto}>
              {c.objeto}
            </p>
          </div>
          <Link
            href={`/contratacion/expedientes/${c.id}`}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-stone-50 text-stone-500 hover:bg-cdmb-50 hover:text-cdmb-700"
            title="Abrir expediente"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          <Dato etiqueta="Valor del contrato">
            {valorTotal !== null ? formatearPesosCO(valorTotal) : "—"}
            {c.valorAdicionado > 0 && <span className="ml-1 text-[10px] text-acento-700">con adición</span>}
          </Dato>
          <Dato etiqueta="Inicio">{fecha(c.inicio)}</Dato>
          <Dato etiqueta="Terminación">
            {fecha(c.terminacion)}
            {c.prorrogas > 0 && <span className="ml-1 text-[10px] text-acento-700">prorrogado</span>}
          </Dato>
          <Dato etiqueta={c.relacion === "CONTRATISTA" ? "Supervisor" : "Contratista"}>
            {c.relacion === "CONTRATISTA" ? c.supervisores.join(", ") || "—" : c.contratista ?? "—"}
          </Dato>
        </dl>

        {c.ejecucion !== null && (
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-stone-700">Ejecución del plazo {c.ejecucion}%</span>
              <span className="text-stone-400">
                {c.diasParaTerminar !== null && c.diasParaTerminar >= 0 ? `${c.diasParaTerminar} día(s) para la terminación` : "Terminación vencida"}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-gradient-to-r from-cdmb-500 to-acento-500" style={{ width: `${c.ejecucion}%` }} />
            </div>
          </div>
        )}

        {c.periodos.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-stone-700">
              Informes mensuales <span className="font-normal text-stone-400">· {radicados} de {c.periodos.length} radicados</span>
            </p>
            <LineaInformes periodos={c.periodos} />
          </div>
        )}

        {c.firmas.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-stone-600">
            <PenLine className="h-3.5 w-3.5 text-red-500" aria-hidden />
            {firmasListas > 0 ? `${firmasListas} documento(s) para firmar` : `${c.firmas.length} firma(s) en espera de turno`}
          </p>
        )}
      </div>

      {c.siguiente ? (
        <Link
          href={c.siguiente.link}
          className="group mt-auto flex items-center justify-between gap-3 bg-gradient-to-r from-acento-500 to-acento-600 px-4 py-2 text-white hover:from-acento-600 hover:to-acento-700"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/80">Siguiente paso</span>
            <span className="block truncate text-xs font-semibold">
              {c.siguiente.texto} · <span className="font-normal">{c.siguiente.detalle}</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 flex-none transition group-hover:translate-x-1" aria-hidden />
        </Link>
      ) : (
        <div className="mt-auto flex items-center gap-2 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Al día
        </div>
      )}
    </article>
  );
}

export function MisContratos({ contratos }: { contratos: ContratoLanding[] }) {
  const propios = contratos.filter((c) => c.relacion === "CONTRATISTA").length;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Briefcase className="h-4 w-4" aria-hidden />
          </span>
          {propios > 0 ? "Mis contratos" : "Contratos que supervisa"}
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">{contratos.length}</span>
        </h2>
        <Link href="/contratacion/panel" className="text-xs font-medium text-cdmb-700 hover:underline">
          Ir a GECON
        </Link>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${contratos.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {contratos.map((c) => (
          <TarjetaContrato key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}

export function SeguimientoContratos({ datos }: { datos: DatosSeguimiento }) {
  const { filas: visibles, total, enEjecucion, informes, firmas, porTerminar } = datos;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Briefcase className="h-4 w-4" aria-hidden />
          </span>
          Seguimiento de contratos
        </h2>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{enEjecucion} en ejecución</span>
          <span className="rounded-full bg-acento-50 px-2.5 py-1 font-medium text-acento-700">{informes} informe(s) por radicar</span>
          <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">{firmas} firma(s) pendiente(s)</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700">{porTerminar} por terminar en 15 días</span>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-xs text-stone-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
          Todos los contratos en ejecución están al día.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="hidden bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400 md:table-header-group">
            <tr>
              <th className="px-4 py-1.5">Contrato</th>
              <th className="px-3 py-1.5">Contratista</th>
              <th className="px-3 py-1.5">Terminación</th>
              <th className="px-3 py-1.5">Informes mensuales</th>
              <th className="px-3 py-1.5">Pendientes</th>
              <th className="px-4 py-1.5" aria-label="Acción" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visibles.map((f) => (
              <tr key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 hover:bg-stone-50/70 md:table-row md:p-0">
                <td className="basis-full md:px-4 md:py-1.5">
                  <Link href={`/contratacion/expedientes/${f.id}`} className="font-medium text-stone-800 hover:text-cdmb-700">
                    N.° {f.numeroContrato ?? "sin número"}
                  </Link>
                  {f.codigoProceso && <span className="block font-mono text-[10px] text-stone-500">{f.codigoProceso}</span>}
                  <span className="block text-[10px] text-stone-400">{f.numero}</span>
                </td>
                <td className="max-w-[220px] truncate text-stone-600 md:px-3 md:py-1.5">{f.contratista ?? "Sin contratista"}</td>
                <td className="whitespace-nowrap md:px-3 md:py-1.5">
                  <span className="flex items-center gap-1 text-stone-600">
                    <CalendarClock className="h-3.5 w-3.5 text-stone-400" aria-hidden />
                    {fecha(f.terminacion)}
                  </span>
                  {f.diasParaTerminar !== null && f.diasParaTerminar <= 15 && (
                    <span className={`text-[10px] font-medium ${f.diasParaTerminar < 0 ? "text-red-600" : "text-sky-700"}`}>
                      {f.diasParaTerminar < 0 ? "Vencida" : `Faltan ${f.diasParaTerminar} día(s)`}
                    </span>
                  )}
                </td>
                <td className="md:px-3 md:py-1.5">
                  <span className="flex flex-wrap items-center gap-0.5">
                    {f.periodos.map((p) => {
                      const clase = {
                        radicado: "bg-emerald-500 text-white",
                        pendiente: "bg-acento-500 text-white",
                        "en-curso": "bg-white text-sky-600 ring-1 ring-sky-300",
                        futuro: "bg-stone-100 text-stone-400",
                      }[p.estado];
                      const punto = (
                        <span className={`flex h-5 min-w-[1.75rem] items-center justify-center rounded px-1 text-[10px] font-semibold capitalize ${clase}`}>{p.mes}</span>
                      );
                      return p.link ? (
                        <Link key={p.clave} href={p.link} title={`Informe ${p.rango}`}>
                          {punto}
                        </Link>
                      ) : (
                        <span key={p.clave} title={`Informe ${p.rango}`}>
                          {punto}
                        </span>
                      );
                    })}
                  </span>
                </td>
                <td className="md:px-3 md:py-1.5">
                  <span className="flex flex-wrap gap-1 text-[11px]">
                    {f.informesPorRadicar > 0 && (
                      <span className="rounded-full bg-acento-50 px-2 py-0.5 font-medium text-acento-700">
                        {f.informesPorRadicar} informe(s){f.maxRetraso > 0 ? ` · ${f.maxRetraso} d` : ""}
                      </span>
                    )}
                    {f.firmasPendientes > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">{f.firmasPendientes} firma(s)</span>}
                  </span>
                </td>
                <td className="ml-auto md:ml-0 md:px-4 md:py-1.5 md:text-right">
                  <Link href={f.link} className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
                    Atender <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {total > visibles.length && (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2 text-xs">
          <span className="text-stone-400">
            Mostrando {visibles.length} de {total} contratos con pendientes, los más atrasados primero.
          </span>
          <Link href="/contratacion/expedientes?etapa=CONTRACTUAL" className="inline-flex items-center gap-1 font-medium text-cdmb-700 hover:underline">
            <Search className="h-3.5 w-3.5" aria-hidden />
            Ver todos
          </Link>
        </div>
      )}
    </section>
  );
}
