import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas, puedeVerTableroContratos, tieneRolContratacion } from "@/lib/permisos";
import { obtenerTableroContratos, type FilaContrato } from "@/lib/contratacion-tablero";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { TituloSeccion, Panel, Sub } from "@/components/sgdea/ui";
import { formatearFecha } from "@/lib/fecha";

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;
const millones = (v: number) => `$ ${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-white px-4 py-3 shadow-soft">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{etiqueta}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-stone-900">{valor}</p>
      {detalle && <p className="text-[11px] text-stone-500">{detalle}</p>}
    </div>
  );
}

function Lista({ filas, vacio, columna }: { filas: FilaContrato[]; vacio: string; columna: (f: FilaContrato) => string }) {
  if (filas.length === 0) return <p className="text-xs text-stone-400">{vacio}</p>;
  return (
    <ul className="divide-y divide-stone-100 text-xs">
      {filas.slice(0, 10).map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 py-1.5">
          <Link href={`/contratacion/expedientes/${f.id}`} className="min-w-0 hover:text-cdmb-700">
            <span className="font-medium text-stone-800">{f.numeroContrato ?? f.codigo}</span>
            <span className="block truncate text-stone-500">{f.contratista ?? "Sin contratista"}</span>
          </Link>
          <span className="flex-none text-right tabular-nums text-stone-700">{columna(f)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function TableroContratosPage({ searchParams }: { searchParams: Promise<{ vigencia?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const global = puedeGestionarContratistas(permisos);
  if (!puedeVerTableroContratos(permisos)) {
    return <AccesoRestringido titulo="Contratos y recursos" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }
  const titulo = tieneRolContratacion(permisos, "JEFE_DEPENDENCIA")
    ? "Contratos de su dependencia"
    : tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION")
      ? "Contratos a su cargo"
      : "Mis contratos supervisados";
  const sp = await searchParams;
  const vigencia = sp.vigencia && /^\d{4}$/.test(sp.vigencia) ? Number(sp.vigencia) : null;
  const t = await obtenerTableroContratos(permisos, vigencia);
  const tt = t.totales;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TituloSeccion icon={Landmark}>{global ? "Contratos y recursos" : titulo}</TituloSeccion>
        <nav className="flex flex-wrap gap-1 text-xs" aria-label="Vigencia">
          {[null, ...t.vigencias].map((v) => (
            <Link
              key={v ?? "todas"}
              href={v ? `/contratacion/panel/contratos?vigencia=${v}` : "/contratacion/panel/contratos"}
              className={`rounded-full border px-2.5 py-1 font-medium ${v === vigencia ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300"}`}
            >
              {v ?? "Todas"}
            </Link>
          ))}
        </nav>
      </div>
      <p className="-mt-2 text-xs text-stone-500">
        Valores de SECOP II (fuente oficial) para los {tt.enlazadosSecop} de {tt.contratos} contratos enlazados; los demás, con el valor registrado en GECON.
        Vigencia por año de suscripción.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato etiqueta="Valor contratado" valor={pesos(tt.valorContratado)} detalle={`${tt.contratos} contrato(s)`} />
        <Dato etiqueta="Valor pagado" valor={pesos(tt.valorPagado)} detalle={tt.ejecucionFinanciera !== null ? `${tt.ejecucionFinanciera} % de ejecución financiera` : undefined} />
        <Dato etiqueta="Facturado" valor={pesos(tt.valorFacturado)} detalle={`Pendiente de pago: ${pesos(tt.pendientePago)}`} />
        <Dato
          etiqueta="Contratistas"
          valor={tt.contratistas.toLocaleString("es-CO")}
          detalle={`${tt.personasNaturales} persona(s) natural(es) · ${tt.personasJuridicas} jurídica(s)`}
        />
        <Dato etiqueta="En ejecución" valor={tt.enEjecucion.toLocaleString("es-CO")} />
        <Dato etiqueta="En precontractual" valor={tt.precontractual.toLocaleString("es-CO")} />
        <Dato etiqueta="Terminados" valor={tt.terminados.toLocaleString("es-CO")} />
        <Dato etiqueta="Por liquidar" valor={tt.porLiquidar.toLocaleString("es-CO")} detalle="Obra, suministro y demás que exigen acta" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <Sub>Valor por modalidad de selección</Sub>
          <BarChartHorizontal data={t.valorPorModalidad} emptyMessage="Sin contratos con valor." formatValue={millones} />
        </Panel>
        <Panel>
          <Sub>Valor por dependencia solicitante</Sub>
          <BarChartHorizontal data={t.valorPorDependencia} emptyMessage="Sin contratos con valor." formatValue={millones} />
        </Panel>
        <Panel>
          <Sub>Valor por tipo de contrato</Sub>
          <BarChartHorizontal data={t.valorPorTipo} emptyMessage="Sin contratos con valor." formatValue={millones} />
        </Panel>
        <Panel>
          <Sub>Contratos por estado en SECOP II</Sub>
          <BarChartHorizontal data={t.contratosPorEstadoSecop} emptyMessage="Sin contratos." />
        </Panel>
        <Panel>
          <Sub>Valor por origen de los recursos</Sub>
          <BarChartHorizontal data={t.valorPorOrigen} emptyMessage="Sin contratos enlazados con SECOP II." formatValue={millones} />
        </Panel>
        <Panel>
          <Sub>Valor por destino del gasto</Sub>
          <BarChartHorizontal data={t.valorPorDestino} emptyMessage="Sin contratos enlazados con SECOP II." formatValue={millones} />
        </Panel>
        {global && (
          <Panel>
            <Sub>Contratistas con mayor valor contratado</Sub>
            <BarChartHorizontal data={t.topContratistas} emptyMessage="Sin contratistas." formatValue={millones} />
          </Panel>
        )}
        <Panel>
          <Sub>Terminan en los próximos 30 días</Sub>
          <Lista
            filas={t.porTerminar}
            vacio="Ningún contrato termina en los próximos 30 días."
            columna={(f) => `${formatearFecha(f.terminacion)} · ${f.diasParaTerminar} d`}
          />
        </Panel>
        <Panel>
          <Sub>Pagos rezagados frente al plazo</Sub>
          <p className="mb-2 text-xs text-stone-500">Contratos cuyo porcentaje pagado está 25 puntos o más por debajo del plazo transcurrido.</p>
          <Lista filas={t.rezagados} vacio="Ningún contrato con pagos rezagados." columna={(f) => `${f.porcentajePagado} % pagado · ${f.porcentajePlazo} % del plazo`} />
        </Panel>
      </div>
    </section>
  );
}
