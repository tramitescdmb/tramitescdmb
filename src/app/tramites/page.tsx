import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHelp } from "@/components/Field";
import { getCatalogoTramites, tiempoEstimadoDias, resumenSinPrefijo } from "@/lib/tramites-data";
import { categoriaTramite, todosLosSuitNumeros, CATEGORIAS_ORDEN, type Categoria } from "@/lib/tramite-categoria";

const ESTADOS_ACTIVOS = ["RADICADO", "EN_TRAMITE", "INFORMACION_ADICIONAL_REQUERIDA", "SUSPENDIDO"];

type Tramite = Awaited<ReturnType<typeof getCatalogoTramites>>[number];
type Conteo = { activos: number; aprobados: number; negados: number };

/** Una tarjeta del catálogo — normalmente un trámite completo, salvo el caso "PR21" (ver abajo). */
type EntradaCatalogo = {
  key: string;
  tramite: Tramite;
  nombre: string;
  suits: string[];
  flujoParaTiempo: Tramite["flujos"][number] | undefined;
  conteo: Conteo | undefined;
};

/**
 * Si el SUIT registra cada flujo de un trámite como una ficha separada (ej.
 * M-DA-PR21: un solo procedimiento/PDF, pero "Concesión de Aguas
 * Superficiales" y "Concesión de Aguas Subterráneas" son dos servicios
 * distintos en el SUIT), el catálogo debe mostrar una tarjeta por flujo, no
 * una tarjeta con dos insignias SUIT pegadas — así el usuario reconoce cada
 * servicio del SUIT como su propia tarjeta, igual que en cdmb.gov.co.
 * Si no aplica (caso normal: todo el trámite es un solo registro, o los
 * flujos son etapas del mismo servicio como "inicio"/"renovación"), se
 * muestra la tarjeta única de siempre.
 */
function entradasDe(t: Tramite, conteoPorTramite: Map<string, Conteo>, conteoPorFlujo: Map<string, Conteo>): EntradaCatalogo[] {
  const seSepaporFlujo = t.flujos.length >= 2 && t.flujos.every((f) => f.suitNumero);
  if (seSepaporFlujo) {
    return t.flujos.map((f) => ({
      key: f.id,
      tramite: t,
      nombre: f.nombre,
      suits: f.suitNumero ? [f.suitNumero] : [],
      flujoParaTiempo: f,
      conteo: conteoPorFlujo.get(f.id),
    }));
  }
  const flujoPrincipal = t.flujos.find((f) => f.esFlujoInicial) ?? t.flujos[0];
  return [
    {
      key: t.id,
      tramite: t,
      nombre: t.nombre,
      suits: todosLosSuitNumeros(t),
      flujoParaTiempo: flujoPrincipal,
      conteo: conteoPorTramite.get(t.id),
    },
  ];
}

export default async function CatalogoTramitesPage() {
  const [tramites, porEstado] = await Promise.all([
    getCatalogoTramites(),
    db.expediente.groupBy({ by: ["tramiteTipoId", "flujoId", "estado"], _count: { _all: true } }),
  ]);

  const conteoPorTramite = new Map<string, Conteo>();
  const conteoPorFlujo = new Map<string, Conteo>();
  for (const row of porEstado) {
    const sumar = (mapa: Map<string, Conteo>, clave: string) => {
      const actual = mapa.get(clave) ?? { activos: 0, aprobados: 0, negados: 0 };
      if (ESTADOS_ACTIVOS.includes(row.estado)) actual.activos += row._count._all;
      else if (row.estado === "APROBADO") actual.aprobados += row._count._all;
      else if (row.estado === "NEGADO" || row.estado === "RECHAZADO") actual.negados += row._count._all;
      mapa.set(clave, actual);
    };
    sumar(conteoPorTramite, row.tramiteTipoId);
    sumar(conteoPorFlujo, row.flujoId);
  }

  const entradas = tramites.flatMap((t) => entradasDe(t, conteoPorTramite, conteoPorFlujo));

  const porCategoria = new Map<string, EntradaCatalogo[]>();
  for (const entrada of entradas) {
    const cat = categoriaTramite(entrada.tramite.nombre, entrada.tramite.codigo, todosLosSuitNumeros(entrada.tramite));
    const lista = porCategoria.get(cat.id) ?? [];
    lista.push(entrada);
    porCategoria.set(cat.id, lista);
  }
  const secciones = CATEGORIAS_ORDEN.map((cat) => ({ cat, items: porCategoria.get(cat.id) ?? [] })).filter(
    (s) => s.items.length > 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Catálogo de trámites</h1>
        <p className="text-sm text-stone-500">
          Los {tramites.length} trámites ambientales que atiende la CDMB, organizados por recurso o tema
          — mismo criterio que usan otras Corporaciones Autónomas Regionales.
        </p>
      </div>

      <SectionHelp>
        Entra a un trámite para ver el detalle completo y, desde ahí, iniciar un expediente nuevo.
      </SectionHelp>

      <nav className="flex flex-wrap gap-3" aria-label="Ir a una categoría">
        {secciones.map(({ cat, items }) => (
          <a
            key={cat.id}
            href={`#cat-${cat.id}`}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition hover:brightness-95 ${cat.clases.badge}`}
          >
            <span className="text-2xl leading-none" aria-hidden>{cat.emoji}</span>
            {cat.etiqueta}
            <span className="opacity-60">({items.length})</span>
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        {secciones.map(({ cat, items }) => (
          <details key={cat.id} id={`cat-${cat.id}`} open className="scroll-mt-20 group">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 border-b border-stone-200 pb-2 [&::-webkit-details-marker]:hidden">
              <span
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-base ${cat.clases.icono}`}
                aria-hidden
              >
                {cat.emoji}
              </span>
              <h2 className="text-base font-semibold text-stone-900">{cat.etiqueta}</h2>
              <span className="text-sm text-stone-400">({items.length})</span>
              <svg
                className="ml-auto h-4 w-4 flex-none text-stone-400 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((entrada) => (
                <TarjetaTramite key={entrada.key} entrada={entrada} categoria={cat} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function TarjetaTramite({ entrada, categoria }: { entrada: EntradaCatalogo; categoria: Categoria }) {
  const { tramite: t, nombre, suits, flujoParaTiempo, conteo } = entrada;
  const tiempo = flujoParaTiempo ? tiempoEstimadoDias(flujoParaTiempo.pasos) : null;

  return (
    <Link
      href={`/tramites/${t.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white p-4 pt-5 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg"
    >
      <span className={`absolute inset-x-0 top-0 h-1.5 ${categoria.clases.barra}`} aria-hidden />

      <div className="mb-3 flex items-center justify-between">
        <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-500">
          {t.codigo} · v{t.version}
        </span>
        {tiempo && (tiempo.total > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
            🕒 ~{tiempo.total} días
          </span>
        ) : (
          <span className="text-xs text-stone-300" title="El procedimiento oficial no especifica tiempos por actividad">
            🕒 sin tiempo especificado
          </span>
        ))}
      </div>

      <div className="mb-2 flex items-start gap-3">
        <span
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-xl ${categoria.clases.icono}`}
          title={categoria.etiqueta}
          aria-hidden
        >
          {categoria.emoji}
        </span>
        <h3 className="pt-1 font-semibold leading-snug text-stone-900 transition group-hover:text-cdmb-700">
          {nombre}
        </h3>
      </div>

      {suits.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suits.map((numero) => (
            <span
              key={numero}
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500"
              title={`Inscrito en el SUIT (Sistema Único de Información de Trámites), ficha ${numero}. Entra al trámite para ver el enlace a la ficha oficial.`}
            >
              🏛️ SUIT {numero}
            </span>
          ))}
        </div>
      )}

      <p className="flex-1 text-sm text-stone-500">{t.resumen ? resumenSinPrefijo(t.resumen) : t.objeto}</p>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
        {!conteo && <span className="text-xs text-stone-300">Sin expedientes todavía</span>}
        {conteo && conteo.activos > 0 && <CountPill color="amber" value={conteo.activos} label="activo" />}
        {conteo && conteo.aprobados > 0 && <CountPill color="green" value={conteo.aprobados} label="aprobado" />}
        {conteo && conteo.negados > 0 && <CountPill color="red" value={conteo.negados} label="negado" />}
      </div>
    </Link>
  );
}

function CountPill({ value, label, color }: { value: number; label: string; color: "amber" | "green" | "red" }) {
  const classes = {
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
  }[color];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {value} {label}
      {value === 1 ? "" : "s"}
    </span>
  );
}
