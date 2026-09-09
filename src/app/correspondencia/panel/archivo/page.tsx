import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, FolderCheck, Files, Handshake } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelArchivoVista } from "@/lib/correspondencia-panel";
import { TarjetaKpi, Sub, Panel, TituloSeccion } from "@/components/sgdea/ui";

export default async function PanelArchivoVistaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const ex = await obtenerPanelArchivoVista(permisos);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={FolderOpen}>Expedientes y archivo</TituloSeccion>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TarjetaKpi icon={FolderOpen} label="Expedientes abiertos" value={ex.abiertos} tono="cdmb" href="/correspondencia/expedientes" />
        <TarjetaKpi icon={FolderCheck} label="Expedientes cerrados" value={ex.cerrados} tono="verde" />
        <TarjetaKpi icon={Files} label="Documentos en expedientes" value={ex.documentos} />
        <TarjetaKpi
          icon={Handshake}
          label="Préstamos activos"
          value={ex.conPrestamoActivo}
          tono={ex.conPrestamoActivo > 0 ? "ambar" : "neutro"}
          href="/correspondencia/expedientes"
        />
      </div>

      {ex.esAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel>
            <Sub>Transferencias a archivo central</Sub>
            <p className="mb-3 text-xs text-stone-500">
              Estado de las transferencias registradas (el detalle, con fechas, está en Disposición final).
            </p>
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
            <Link href="/correspondencia/disposicion" className="mt-3 inline-block text-xs font-medium text-cdmb-700 hover:underline">
              Ir a Disposición final →
            </Link>
          </Panel>
          <Panel>
            <Sub>Tabla de Retención Documental</Sub>
            <p className="mb-3 text-xs text-stone-500">Tamaño actual de la TRD vigente.</p>
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
            <Link href="/correspondencia/admin" className="mt-3 inline-block text-xs font-medium text-cdmb-700 hover:underline">
              Administrar TRD →
            </Link>
          </Panel>
        </div>
      )}
    </section>
  );
}
