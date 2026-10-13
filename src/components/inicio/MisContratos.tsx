import Link from "next/link";
import { ArrowRight, Briefcase, Check, CheckCircle2, PenLine } from "lucide-react";
import type { ContratoLanding, EstadoPeriodo } from "@/lib/contratos-landing";

const ETAPAS: { id: ContratoLanding["etapa"]; etiqueta: string }[] = [
  { id: "PRECONTRACTUAL", etiqueta: "Precontractual" },
  { id: "CONTRACTUAL", etiqueta: "Contractual" },
  { id: "POSTCONTRACTUAL", etiqueta: "Postcontractual" },
];

const CLASE_PERIODO: Record<EstadoPeriodo, string> = {
  radicado: "bg-emerald-500 text-white",
  pendiente: "bg-acento-500 text-white ring-2 ring-acento-200 hover:bg-acento-600",
  "en-curso": "bg-white text-sky-700 ring-2 ring-sky-300",
  futuro: "bg-stone-100 text-stone-400",
};

const TEXTO_PERIODO: Record<EstadoPeriodo, string> = {
  radicado: "Radicado",
  pendiente: "Por radicar",
  "en-curso": "En curso",
  futuro: "Próximo",
};

function fecha(d: Date | null) {
  return d ? d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
}

function Etapas({ actual }: { actual: ContratoLanding["etapa"] }) {
  const indice = ETAPAS.findIndex((e) => e.id === actual);
  return (
    <ol className="flex items-center gap-1.5">
      {ETAPAS.map((e, i) => (
        <li key={e.id} className="flex flex-1 flex-col gap-1">
          <span className={`h-1.5 rounded-full ${i < indice ? "bg-emerald-500" : i === indice ? "bg-acento-500" : "bg-stone-200"}`} />
          <span className={`text-[10px] font-medium ${i === indice ? "text-stone-900" : "text-stone-400"}`}>{e.etiqueta}</span>
        </li>
      ))}
    </ol>
  );
}

function TarjetaContrato({ c }: { c: ContratoLanding }) {
  const pendientes = c.periodos.filter((p) => p.estado === "pendiente").length;
  const radicados = c.periodos.filter((p) => p.estado === "radicado").length;
  const firmasListas = c.firmas.filter((f) => f.puedeActuar).length;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${c.relacion === "CONTRATISTA" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
                {c.relacion === "CONTRATISTA" ? "Contratista" : "Supervisión"}
              </span>
              {c.numero}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-stone-900">{c.numeroContrato ? `Contrato ${c.numeroContrato}` : c.numero}</h3>
            <p className="line-clamp-2 text-sm text-stone-500" title={c.objeto}>
              {c.objeto}
            </p>
            {c.relacion === "SUPERVISOR" && c.contratista && <p className="mt-0.5 text-xs text-stone-400">{c.contratista}</p>}
          </div>
          <Link
            href={`/contratacion/expedientes/${c.id}`}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-stone-50 text-stone-500 hover:bg-cdmb-50 hover:text-cdmb-700"
            title="Abrir expediente"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <Etapas actual={c.etapa} />

        {c.avance !== null && (
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-stone-700">Plazo {c.avance}%</span>
              <span className="text-stone-400">
                {c.diasRestantes !== null && c.diasRestantes >= 0 ? `Faltan ${c.diasRestantes} día(s)` : "Plazo vencido"}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-gradient-to-r from-cdmb-500 to-acento-500" style={{ width: `${c.avance}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-stone-400">
              <span>{fecha(c.inicio)}</span>
              <span>{fecha(c.fin)}</span>
            </div>
          </div>
        )}

        {c.periodos.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-stone-700">
              Informes mensuales <span className="font-normal text-stone-400">· {radicados} de {c.periodos.length} radicados</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {c.periodos.map((p) => (
                <Link
                  key={p.clave}
                  href={p.link}
                  title={`Informe N.° ${p.numero} · ${p.rango} · ${TEXTO_PERIODO[p.estado]}${p.diasDeRetraso > 0 ? ` · ${p.diasDeRetraso} día(s) de retraso` : ""}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${CLASE_PERIODO[p.estado]}`}
                >
                  {p.estado === "radicado" ? <Check className="h-4 w-4" aria-hidden /> : p.numero}
                </Link>
              ))}
            </div>
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
          className="group mt-auto flex items-center justify-between gap-3 bg-gradient-to-r from-acento-500 to-acento-600 px-5 py-3.5 text-white hover:from-acento-600 hover:to-acento-700"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/80">Siguiente paso</span>
            <span className="block truncate text-sm font-semibold">
              {c.siguiente.texto} · <span className="font-normal">{c.siguiente.detalle}</span>
            </span>
          </span>
          <ArrowRight className="h-5 w-5 flex-none transition group-hover:translate-x-1" aria-hidden />
        </Link>
      ) : (
        <div className="mt-auto flex items-center gap-2 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          {pendientes === 0 ? "Al día" : "Sin acciones pendientes"}
        </div>
      )}
    </article>
  );
}

export function MisContratos({ contratos }: { contratos: ContratoLanding[] }) {
  const propios = contratos.some((c) => c.relacion === "CONTRATISTA");
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Briefcase className="h-4 w-4" aria-hidden />
          </span>
          {propios ? "Mis contratos" : "Contratos que supervisa"}
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">{contratos.length}</span>
        </h2>
        <Link href="/contratacion/panel" className="text-xs font-medium text-cdmb-700 hover:underline">
          Ir a GECON
        </Link>
      </div>
      <div className={`grid grid-cols-1 gap-4 ${contratos.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {contratos.map((c) => (
          <TarjetaContrato key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}
