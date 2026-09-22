import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, Briefcase, UserSquare2, FileSearch, UserCog, ScrollText, Lock, ShieldCheck } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeAdministrarSigec } from "@/lib/permisos";
import { obtenerResumenSistemaContratacion } from "@/lib/contratacion-panel";
import { TituloSeccion, TarjetaKpi, Panel, Sub } from "@/components/sgdea/ui";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { formatearFechaHora } from "@/lib/fecha";

export default async function PanelSistemaSigecPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  if (!puedeAdministrarSigec(permisos)) {
    return <AccesoRestringido titulo="Sistema" quien="administrador o jefe de contratación" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }

  const r = await obtenerResumenSistemaContratacion();

  return (
    <section className="space-y-4">
      <TituloSeccion icon={ShieldAlert}>Sistema</TituloSeccion>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TarjetaKpi icon={Briefcase} label="Expedientes" value={r.expedientes} tono="cdmb" href="/contratacion/expedientes" />
        <TarjetaKpi icon={UserSquare2} label="Contratistas" value={r.contratistas} tono="azul" href="/contratacion/contratistas" />
        <TarjetaKpi icon={FileSearch} label="Documentos por validar" value={r.documentosPorValidar} tono="ambar" />
        <TarjetaKpi icon={UserCog} label="Usuarios con rol" value={r.usuariosConRol} tono="neutro" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Sub>Actividad reciente</Sub>
            <Link href="/contratacion/bitacora" className="text-xs font-medium text-cdmb-700 hover:underline">
              Ver la bitácora completa
            </Link>
          </div>
          {r.eventos.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">Sin actividad todavía.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {r.eventos.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <Link href={`/contratacion/expedientes/${e.expediente.id}`} className="font-mono text-xs font-medium text-cdmb-700 hover:underline">
                    {e.expediente.numero}
                  </Link>{" "}
                  <span className="text-stone-700">{e.detalle ?? e.tipo}</span>
                  <p className="text-xs text-stone-400">
                    {e.usuario?.nombre ?? "Sistema"} · {formatearFechaHora(e.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <Sub>Administración</Sub>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/contratacion/bitacora" className="flex items-center gap-2 text-stone-700 hover:text-cdmb-700">
                <ScrollText className="h-4 w-4 text-stone-400" aria-hidden /> Bitácora del SIGEC
              </Link>
            </li>
            <li>
              <Link href="/contratacion/auditoria" className="flex items-center gap-2 text-stone-700 hover:text-cdmb-700">
                <ShieldCheck className="h-4 w-4 text-stone-400" aria-hidden /> Auditoría de cuentas
              </Link>
            </li>
            <li>
              <Link href="/contratacion/seguridad" className="flex items-center gap-2 text-stone-700 hover:text-cdmb-700">
                <Lock className="h-4 w-4 text-stone-400" aria-hidden /> Seguridad
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}
