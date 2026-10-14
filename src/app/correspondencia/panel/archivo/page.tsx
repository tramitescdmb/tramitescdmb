import { redirect } from "next/navigation";
import { FolderOpen, FolderCheck, Files, Handshake, ArrowRightLeft, Table2 } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelArchivoVista } from "@/lib/correspondencia-panel";
import { CabeceraTablero, EnlaceTablero, Indicador, TarjetaTablero } from "@/components/tablero";

export default async function PanelArchivoVistaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const ex = await obtenerPanelArchivoVista(permisos);

  return (
    <section className="space-y-4">
      <CabeceraTablero titulo="Expedientes y archivo" descripcion="Expedientes documentales, préstamos y retención documental.">
        <Indicador icon={FolderOpen} valor={ex.abiertos} etiqueta="Abiertos" tono="cdmb" href="/correspondencia/expedientes" />
        <Indicador icon={FolderCheck} valor={ex.cerrados} etiqueta="Cerrados" tono="verde" />
        <Indicador icon={Files} valor={ex.documentos} etiqueta="Documentos" tono="neutro" />
        <Indicador icon={Handshake} valor={ex.conPrestamoActivo} etiqueta="Préstamos activos" tono={ex.conPrestamoActivo > 0 ? "ambar" : "neutro"} href="/correspondencia/expedientes" />
      </CabeceraTablero>

      {ex.esAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TarjetaTablero
            icon={ArrowRightLeft}
            tono="cielo"
            titulo="Transferencias a archivo central"
            descripcion="El detalle, con fechas, está en Disposición final."
            accion={<EnlaceTablero href="/correspondencia/disposicion">Disposición final</EnlaceTablero>}
          >
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-[11px] text-stone-400">Registradas</dt>
                <dd className="text-lg font-semibold tabular-nums text-stone-800">{ex.transferencias.total}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-stone-400">Confirmadas</dt>
                <dd className="text-lg font-semibold tabular-nums text-emerald-700">{ex.transferencias.confirmadas}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-stone-400">Sin confirmar</dt>
                <dd className="text-lg font-semibold tabular-nums text-amber-700">{ex.transferencias.sinConfirmar}</dd>
              </div>
            </dl>
          </TarjetaTablero>
          <TarjetaTablero
            icon={Table2}
            tono="violeta"
            titulo="Tabla de Retención Documental"
            descripcion="Tamaño actual de la TRD vigente."
            accion={<EnlaceTablero href="/correspondencia/admin">Administrar TRD</EnlaceTablero>}
          >
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-stone-400">Series vigentes</dt>
                <dd className="text-lg font-semibold tabular-nums text-stone-800">{ex.trd.seriesVigentes}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-stone-400">Subseries activas</dt>
                <dd className="text-lg font-semibold tabular-nums text-stone-800">{ex.trd.subseriesActivas}</dd>
              </div>
            </dl>
          </TarjetaTablero>
        </div>
      )}
    </section>
  );
}
