import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  FileText,
  Landmark,
  PiggyBank,
  Receipt,
  Scale,
  Target,
  Users,
  Wallet,
  PlayCircle,
} from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas, puedeVerTableroContratos, veContratosDeSuDependencia, esPersonalContratacion } from "@/lib/permisos";
import { obtenerTableroContratos, type FilaContrato } from "@/lib/contratacion-tablero";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero, FilaTablero, Indicador, ListaTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";
import { formatearFecha } from "@/lib/fecha";

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;
const millones = (v: number) => `$ ${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;

function Lista({ filas, vacio, columna }: { filas: FilaContrato[]; vacio: string; columna: (f: FilaContrato) => string }) {
  if (filas.length === 0) return <VacioTablero>{vacio}</VacioTablero>;
  return (
    <ListaTablero>
      {filas.slice(0, 10).map((f) => (
        <FilaTablero
          key={f.id}
          href={`/contratacion/expedientes/${f.id}`}
          titulo={f.numeroContrato ?? f.codigo}
          detalle={f.contratista ?? "Sin contratista"}
          extra={<span className="text-right text-xs tabular-nums text-stone-600">{columna(f)}</span>}
        />
      ))}
    </ListaTablero>
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
  const titulo = veContratosDeSuDependencia(permisos)
    ? "Contratos de su dependencia"
    : esPersonalContratacion(permisos)
      ? "Contratos a su cargo"
      : "Mis contratos supervisados";
  const sp = await searchParams;
  const vigencia = sp.vigencia && /^\d{4}$/.test(sp.vigencia) ? Number(sp.vigencia) : null;
  const t = await obtenerTableroContratos(permisos, vigencia);
  const tt = t.totales;

  return (
    <section className="space-y-4">
      <CabeceraTablero
        antetitulo={vigencia ? `Vigencia ${vigencia}` : "Todas las vigencias"}
        titulo={global ? "Contratos y recursos" : titulo}
        descripcion={`Valores de SECOP II para ${tt.enlazadosSecop} de ${tt.contratos} contratos; los demás, con el valor registrado en GECON.`}
        acciones={
          <nav className="flex flex-wrap gap-1" aria-label="Vigencia">
            {[null, ...t.vigencias].map((v) => (
              <Link
                key={v ?? "todas"}
                href={v ? `/contratacion/panel/contratos?vigencia=${v}` : "/contratacion/panel/contratos"}
                className={`rounded-sm px-3 py-1 text-xs font-medium transition ${
                  v === vigencia ? "bg-stone-900 text-white" : "bg-white/70 text-stone-600 ring-1 ring-stone-200 hover:bg-white hover:text-stone-900"
                }`}
              >
                {v ?? "Todas"}
              </Link>
            ))}
          </nav>
        }
      >
        <Indicador icon={Wallet} valor={pesos(tt.valorContratado)} etiqueta="Valor contratado" detalle={`${tt.contratos} contrato(s)`} tono="cdmb" />
        <Indicador
          icon={Banknote}
          valor={pesos(tt.valorPagado)}
          etiqueta="Valor pagado"
          detalle={tt.ejecucionFinanciera !== null ? `${tt.ejecucionFinanciera} % de ejecución financiera` : undefined}
          tono="verde"
        />
        <Indicador icon={Receipt} valor={pesos(tt.valorFacturado)} etiqueta="Facturado" detalle={`Pendiente de pago: ${pesos(tt.pendientePago)}`} tono="acento" />
        <Indicador
          icon={Users}
          valor={tt.contratistas}
          etiqueta="Contratistas"
          detalle={`${tt.personasNaturales} natural(es) · ${tt.personasJuridicas} jurídica(s)`}
          tono="cielo"
        />
        <Indicador icon={PlayCircle} valor={tt.enEjecucion} etiqueta="En ejecución" tono="verde" />
        <Indicador icon={FileClock} valor={tt.precontractual} etiqueta="En precontractual" tono="ambar" />
        <Indicador icon={CheckCircle2} valor={tt.terminados} etiqueta="Terminados" tono="neutro" />
        <Indicador icon={ClipboardCheck} valor={tt.porLiquidar} etiqueta="Por liquidar" detalle="Obra, suministro y demás que exigen acta" tono="violeta" />
      </CabeceraTablero>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TarjetaTablero icon={Scale} tono="violeta" titulo="Valor por modalidad de selección">
          <BarChartHorizontal data={t.valorPorModalidad} emptyMessage="Sin contratos con valor." formatValue={millones} />
        </TarjetaTablero>
        <TarjetaTablero icon={Building2} tono="cielo" titulo="Valor por dependencia solicitante">
          <BarChartHorizontal data={t.valorPorDependencia} emptyMessage="Sin contratos con valor." formatValue={millones} />
        </TarjetaTablero>
        <TarjetaTablero icon={FileText} tono="cdmb" titulo="Valor por tipo de contrato">
          <BarChartHorizontal data={t.valorPorTipo} emptyMessage="Sin contratos con valor." formatValue={millones} />
        </TarjetaTablero>
        <TarjetaTablero icon={Landmark} tono="neutro" titulo="Contratos por estado en SECOP II">
          <BarChartHorizontal data={t.contratosPorEstadoSecop} emptyMessage="Sin contratos." />
        </TarjetaTablero>
        <TarjetaTablero icon={PiggyBank} tono="verde" titulo="Valor por origen de los recursos">
          <BarChartHorizontal data={t.valorPorOrigen} emptyMessage="Sin contratos enlazados con SECOP II." formatValue={millones} />
        </TarjetaTablero>
        <TarjetaTablero icon={Target} tono="acento" titulo="Valor por destino del gasto">
          <BarChartHorizontal data={t.valorPorDestino} emptyMessage="Sin contratos enlazados con SECOP II." formatValue={millones} />
        </TarjetaTablero>
        {global && (
          <TarjetaTablero icon={Users} tono="cielo" titulo="Contratistas con mayor valor contratado">
            <BarChartHorizontal data={t.topContratistas} emptyMessage="Sin contratistas." formatValue={millones} />
          </TarjetaTablero>
        )}
        <TarjetaTablero icon={CalendarClock} tono="ambar" titulo="Terminan en los próximos 30 días" contador={t.porTerminar.length} sinRelleno>
          <Lista
            filas={t.porTerminar}
            vacio="Ningún contrato termina en los próximos 30 días."
            columna={(f) => `${formatearFecha(f.terminacion)} · ${f.diasParaTerminar} d`}
          />
        </TarjetaTablero>
        <TarjetaTablero
          icon={AlertTriangle}
          tono="rojo"
          titulo="Pagos rezagados frente al plazo"
          descripcion="Porcentaje pagado 25 puntos o más por debajo del plazo transcurrido."
          contador={t.rezagados.length}
          sinRelleno
        >
          <Lista filas={t.rezagados} vacio="Ningún contrato con pagos rezagados." columna={(f) => `${f.porcentajePagado} % pagado · ${f.porcentajePlazo} % del plazo`} />
        </TarjetaTablero>
      </div>
    </section>
  );
}
