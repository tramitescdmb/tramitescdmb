import { db } from "@/lib/db";
import { SectionHelp } from "@/components/Field";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { categoriaTramite, todosLosSuitNumeros, CATEGORIAS_ORDEN } from "@/lib/tramite-categoria";
import { CatalogoTramites, type EntradaCatalogo } from "@/components/CatalogoTramites";

const ESTADOS_ACTIVOS = ["RADICADO", "EN_TRAMITE", "INFORMACION_ADICIONAL_REQUERIDA", "SUSPENDIDO"];

type Tramite = Awaited<ReturnType<typeof getCatalogoTramites>>[number];
type Conteo = { activos: number; aprobados: number; negados: number };

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
      flujoCodigoFoco: f.codigo,
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
  // Un componente (función) no se puede pasar como prop de un Server Component a un
  // Client Component — solo datos planos y elementos ya renderizados. Por eso el ícono
  // se resuelve aquí (en JSX, server-side) en vez de mandar `cat.Icono` tal cual.
  const secciones = CATEGORIAS_ORDEN.map((cat) => ({
    cat: {
      id: cat.id,
      etiqueta: cat.etiqueta,
      clases: cat.clases,
      iconoGrande: <cat.Icono className="h-6 w-6" aria-hidden />,
    },
    items: porCategoria.get(cat.id) ?? [],
  })).filter((s) => s.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Catálogo de trámites</h2>
        <p className="text-sm text-stone-500">
          Los {tramites.length} trámites ambientales que atiende la CDMB, organizados por recurso o tema
          — mismo criterio que usan otras Corporaciones Autónomas Regionales.
        </p>
      </div>

      <SectionHelp>
        Puede filtrarse por categoría, o accederse directamente a un trámite para ver el detalle completo
        e iniciar un expediente nuevo.
      </SectionHelp>

      <CatalogoTramites secciones={secciones} />
    </div>
  );
}
