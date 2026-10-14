import { redirect } from "next/navigation";
import { Activity, Briefcase, UserSquare2, FileSearch, UserCog, ScrollText, Lock, ShieldCheck, Settings2 } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeAdministrarGecon } from "@/lib/permisos";
import { obtenerResumenSistemaContratacion } from "@/lib/contratacion-panel";
import { CabeceraTablero, EnlaceTablero, FilaTablero, Indicador, ListaTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { formatearFechaHora } from "@/lib/fecha";

export default async function PanelSistemaGeconPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  if (!puedeAdministrarGecon(permisos)) {
    return <AccesoRestringido titulo="Sistema" quien="administrador o jefe de contratación" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }

  const r = await obtenerResumenSistemaContratacion();

  return (
    <section className="space-y-4">
      <CabeceraTablero titulo="Sistema" descripcion="Actividad reciente y registros del módulo.">
        <Indicador icon={Briefcase} valor={r.expedientes} etiqueta="Expedientes" tono="cdmb" href="/contratacion/expedientes" />
        <Indicador icon={UserSquare2} valor={r.contratistas} etiqueta="Contratistas" tono="cielo" href="/contratacion/contratistas" />
        <Indicador icon={FileSearch} valor={r.documentosPorValidar} etiqueta="Documentos por validar" tono="ambar" />
        <Indicador icon={UserCog} valor={r.usuariosConRol} etiqueta="Usuarios con rol" tono="neutro" />
      </CabeceraTablero>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TarjetaTablero
          icon={Activity}
          titulo="Actividad reciente"
          accion={<EnlaceTablero href="/contratacion/bitacora">Bitácora completa</EnlaceTablero>}
          sinRelleno
          className="lg:col-span-2"
        >
          {r.eventos.length === 0 ? (
            <VacioTablero>Sin actividad todavía.</VacioTablero>
          ) : (
            <ListaTablero>
              {r.eventos.map((e) => (
                <FilaTablero
                  key={e.id}
                  href={`/contratacion/expedientes/${e.expediente.id}`}
                  titulo={
                    <>
                      <span className="font-mono text-xs text-cdmb-700">{e.expediente.numero}</span> <span className="font-normal text-stone-700">{e.detalle ?? e.tipo}</span>
                    </>
                  }
                  detalle={`${e.usuario?.nombre ?? "Sistema"} · ${formatearFechaHora(e.createdAt)}`}
                />
              ))}
            </ListaTablero>
          )}
        </TarjetaTablero>

        <TarjetaTablero icon={Settings2} tono="neutro" titulo="Administración" sinRelleno>
          <ListaTablero>
            <FilaTablero href="/contratacion/bitacora" icon={ScrollText} tono="neutro" titulo="Bitácora del GECON" />
            <FilaTablero href="/contratacion/auditoria" icon={ShieldCheck} tono="neutro" titulo="Auditoría de cuentas" />
            <FilaTablero href="/contratacion/seguridad" icon={Lock} tono="neutro" titulo="Seguridad" />
          </ListaTablero>
        </TarjetaTablero>
      </div>
    </section>
  );
}
