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

function Dato({ etiqueta, envolver, children }: { etiqueta: string; envolver?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{etiqueta}</dt>
      <dd className={`text-xs text-stone-800 ${envolver ? "break-words leading-snug" : "truncate"}`}>{children}</dd>
    </div>
  );
}

function LineaInformes({ periodos }: { periodos: PeriodoLanding[] }) {
  return (
    <ol className="flex">
      {periodos.map((p, i) => {
        const punto = {
          radicado: "bg-emerald-500 text-white",
          pendiente: "bg-white text-acento-600 ring-2 ring-acento-400",
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
  const valorTotal = c.valor;

  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-stone-200 bg-white">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
              <span className={`rounded-sm px-2 py-px font-semibold ${CLASE_ESTADO[c.estado]}`}>{c.estado}</span>
              {c.relacion === "SUPERVISOR" && <span className="rounded-sm bg-sky-50 px-2 py-px font-semibold text-sky-700">Supervisión</span>}
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
            className="flex h-8 w-8 flex-none items-center justify-center text-stone-500 hover:bg-cdmb-50 hover:text-cdmb-700"
            title="Abrir expediente"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          <Dato etiqueta="Valor del contrato">
            {valorTotal !== null ? formatearPesosCO(valorTotal) : "—"}
          </Dato>
          <Dato etiqueta="Inicio">{fecha(c.inicio)}</Dato>
          <Dato etiqueta="Terminación">
            {fecha(c.terminacion)}
          </Dato>
          <Dato etiqueta={c.relacion === "CONTRATISTA" ? "Supervisor" : "Contratista"} envolver>
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
              <div className="h-full rounded-full bg-cdmb-500" style={{ width: `${c.ejecucion}%` }} />
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
          className="group relative mt-auto flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-4 py-2 hover:bg-stone-100"
        >
          <span className="absolute inset-y-0 left-0 w-[3px] bg-acento-500" aria-hidden />
          <span className="min-w-0 text-xs">
            <span className="text-stone-500">Siguiente paso: </span>
            <span className="font-semibold text-stone-800">{c.siguiente.texto}</span>
            <span className="text-stone-500"> · {c.siguiente.detalle}</span>
          </span>
          <ArrowRight className="h-4 w-4 flex-none text-acento-600" aria-hidden />
        </Link>
      ) : (
        <div className="mt-auto flex items-center gap-2 border-t border-stone-200 px-4 py-2 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Al día
        </div>
      )}
    </article>
  );
}

const ANILLO_ESTADO: Record<EstadoContrato, string> = {
  "En ejecución": "border-emerald-500",
  "Por iniciar": "border-sky-500",
  "Plazo vencido": "border-red-500",
  "En liquidación": "border-violet-500",
};

function ChipsInformes({ periodos }: { periodos: PeriodoLanding[] }) {
  return (
    <span className="flex flex-wrap items-center gap-0.5">
      {periodos.map((p) => {
        const clase = {
          radicado: "bg-emerald-500 text-white",
          pendiente: "bg-acento-500 text-white",
          "en-curso": "bg-white text-sky-600 ring-1 ring-sky-300",
          futuro: "bg-stone-100 text-stone-400",
        }[p.estado];
        const titulo = `Informe ${p.rango}${p.estado === "pendiente" && p.diasDeRetraso > 0 ? ` · ${p.diasDeRetraso} día(s) de retraso` : ""}`;
        const punto = <span className={`flex h-5 min-w-[1.75rem] items-center justify-center rounded px-1 text-[10px] font-semibold capitalize ${clase}`}>{p.mes}</span>;
        return p.link ? (
          <Link key={p.clave} href={p.link} title={titulo}>
            {punto}
          </Link>
        ) : (
          <span key={p.clave} title={titulo}>
            {punto}
          </span>
        );
      })}
    </span>
  );
}

function TablaContratos({ contratos }: { contratos: ContratoLanding[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
      <table className="tabla-listado w-full text-xs">
        <thead className="hidden text-left text-[11px] font-semibold uppercase tracking-wide md:table-header-group">
          <tr>
            <th className="px-4 py-2">Contrato</th>
            <th className="px-3 py-2">Contratista</th>
            <th className="px-3 py-2">Plazo</th>
            <th className="px-3 py-2">Informes mensuales</th>
            <th className="px-4 py-2">Siguiente paso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {contratos.map((c) => {
            const firmasListas = c.firmas.filter((f) => f.puedeActuar).length;
            return (
              <tr key={c.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2 md:table-row md:p-0">
                <td className="basis-full align-top md:max-w-[22rem] md:px-4 md:py-2">
                  <Link href={`/contratacion/expedientes/${c.id}`} className="font-semibold text-stone-800 hover:text-cdmb-700">
                    N.° {c.numeroContrato ?? "sin número"}
                  </Link>
                  {c.codigoProceso && <span className="ml-1.5 font-mono text-[10px] text-stone-500">{c.codigoProceso}</span>}
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-600">
                    <span className={`h-2.5 w-2.5 flex-none rounded-full border-2 ${ANILLO_ESTADO[c.estado]}`} aria-hidden />
                    {c.estado}
                  </span>
                  <span className="mt-0.5 line-clamp-1 text-[11px] text-stone-400" title={c.objeto}>
                    {c.objeto}
                  </span>
                </td>
                <td className="max-w-[200px] break-words align-top leading-snug text-stone-600 md:px-3 md:py-2">
                  {c.relacion === "CONTRATISTA" ? c.supervisores.join(", ") || "—" : c.contratista ?? "Sin contratista"}
                </td>
                <td className="w-40 align-top md:px-3 md:py-2">
                  <span className="text-stone-700">{fecha(c.terminacion)}</span>
                  {c.ejecucion !== null && (
                    <>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-stone-200">
                        <span className="block h-full bg-cdmb-500" style={{ width: `${c.ejecucion}%` }} />
                      </span>
                      <span className={`text-[10px] ${c.diasParaTerminar !== null && c.diasParaTerminar < 0 ? "font-medium text-red-600" : "text-stone-400"}`}>
                        {c.ejecucion}% ·{" "}
                        {c.diasParaTerminar !== null && c.diasParaTerminar >= 0 ? `${c.diasParaTerminar} día(s)` : "vencida"}
                      </span>
                    </>
                  )}
                </td>
                <td className="align-top md:px-3 md:py-2">
                  <ChipsInformes periodos={c.periodos} />
                </td>
                <td className="align-top md:px-4 md:py-2">
                  {c.siguiente ? (
                    <Link href={c.siguiente.link} className="group block max-w-[16rem]">
                      <span className="flex items-center gap-1 font-medium text-cdmb-700 group-hover:underline">
                        {c.siguiente.texto}
                        <ArrowRight className="h-3 w-3 flex-none" aria-hidden />
                      </span>
                      <span className="block truncate text-[10px] text-stone-500">{c.siguiente.detalle}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Al día
                    </span>
                  )}
                  {c.firmas.length > 0 && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-red-700">
                      <PenLine className="h-3 w-3" aria-hidden />
                      {firmasListas > 0 ? `${firmasListas} para firmar` : `${c.firmas.length} en espera de turno`}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MisContratos({ contratos, terminados }: { contratos: ContratoLanding[]; terminados: number }) {
  const propios = contratos.filter((c) => c.relacion === "CONTRATISTA");
  const supervisados = contratos.filter((c) => c.relacion === "SUPERVISOR");
  const encabezado = (titulo: string, cantidad: number, conEnlaces: boolean) => (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Briefcase className="h-4 w-4 text-stone-500" aria-hidden />
        {titulo}
        <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-800">{cantidad}</span>
      </h2>
      {conEnlaces && (
        <span className="flex items-center gap-3 text-xs">
          {terminados > 0 && (
            <Link href="/contratacion/expedientes?etapa=TERMINADOS" className="text-stone-500 hover:underline">
              {terminados} terminado(s)
            </Link>
          )}
          <Link href="/contratacion/panel" className="font-medium text-cdmb-700 hover:underline">
            Ir a GECON
          </Link>
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {propios.length > 0 && (
        <section className="space-y-2">
          {encabezado("Mis contratos", propios.length, true)}
          <div className={`grid grid-cols-1 gap-3 ${propios.length > 1 ? "xl:grid-cols-2" : ""}`}>
            {propios.map((c) => (
              <TarjetaContrato key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
      {(supervisados.length > 0 || propios.length === 0) && (
        <section className="space-y-2">
          {encabezado("Contratos que supervisa", supervisados.length, propios.length === 0)}
          {supervisados.length > 0 && <TablaContratos contratos={supervisados} />}
        </section>
      )}
    </div>
  );
}

export function SeguimientoContratos({ datos }: { datos: DatosSeguimiento }) {
  const { filas: visibles, total, enEjecucion, informes, firmas, porTerminar } = datos;

  return (
    <section className="overflow-hidden rounded-md border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center text-amber-700">
            <Briefcase className="h-4 w-4" aria-hidden />
          </span>
          Seguimiento de contratos
        </h2>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-sm bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{enEjecucion} en ejecución</span>
          <span className="rounded-sm bg-acento-50 px-2.5 py-1 font-medium text-acento-700">{informes} informe(s) por radicar</span>
          <span className="rounded-sm bg-red-50 px-2.5 py-1 font-medium text-red-700">{firmas} firma(s) pendiente(s)</span>
          <span className="rounded-sm bg-sky-50 px-2.5 py-1 font-medium text-sky-700">{porTerminar} por terminar en 15 días</span>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-xs text-stone-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
          Todos los contratos en ejecución están al día.
        </p>
      ) : (
        <table className="tabla-listado w-full text-xs">
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
                <td className="max-w-[240px] break-words leading-snug text-stone-600 md:px-3 md:py-1.5">{f.contratista ?? "Sin contratista"}</td>
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
                  <ChipsInformes periodos={f.periodos} />
                </td>
                <td className="md:px-3 md:py-1.5">
                  <span className="flex flex-wrap gap-1 text-[11px]">
                    {f.informesPorRadicar > 0 && (
                      <span className="rounded-sm bg-acento-50 px-2 py-0.5 font-medium text-acento-700">
                        {f.informesPorRadicar} informe(s){f.maxRetraso > 0 ? ` · ${f.maxRetraso} d` : ""}
                      </span>
                    )}
                    {f.firmasPendientes > 0 && <span className="rounded-sm bg-red-50 px-2 py-0.5 font-medium text-red-700">{f.firmasPendientes} firma(s)</span>}
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
