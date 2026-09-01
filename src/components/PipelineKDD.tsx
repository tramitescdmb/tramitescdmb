import { Database, Sparkles, Shuffle, BrainCircuit, LineChart, ChevronRight } from "lucide-react";

const ETAPAS = [
  { n: 1, titulo: "Selección", icon: Database, desc: "Espejo local de GET /presinca/resoluciones (~5.086 registros)." },
  { n: 2, titulo: "Preprocesado", icon: Sparkles, desc: "Deduplicado; se descartan fechas con año imposible." },
  { n: 3, titulo: "Transformación", icon: Shuffle, desc: "Días de trámite, perfil de tipos por municipio, bolsa de palabras." },
  { n: 4, titulo: "Minería", icon: BrainCircuit, desc: "Regresión, k-means, Naive Bayes, IQR, z-score robusto." },
  { n: 5, titulo: "Interpretación", icon: LineChart, desc: "Los hallazgos de esta página." },
];

/**
 * Flujo del proceso KDD (Knowledge Discovery in Databases) como diagrama
 * horizontal con conectores — para que se lea como un proceso y no como una
 * tabla de datos sueltos.
 */
export function PipelineKDD() {
  return (
    <ol className="flex flex-col md:flex-row md:items-stretch">
      {ETAPAS.map((e, i) => {
        const Icon = e.icon;
        return (
          <li key={e.n} className="flex flex-col md:flex-1 md:flex-row md:items-center">
            <div className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cdmb-600 text-xs font-bold text-white">
                  {e.n}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-800">
                  <Icon className="h-4 w-4 text-cdmb-600" aria-hidden />
                  {e.titulo}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-snug text-stone-500">{e.desc}</p>
            </div>
            {i < ETAPAS.length - 1 && (
              <div className="flex flex-none items-center justify-center py-1 text-stone-300 md:px-1 md:py-0">
                <ChevronRight className="h-5 w-5 rotate-90 md:rotate-0" aria-hidden />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
