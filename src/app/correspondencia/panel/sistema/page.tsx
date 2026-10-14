import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ShieldAlert, FileWarning, AlertTriangle, History } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { obtenerPanelSistemaVista } from "@/lib/correspondencia-panel";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { CabeceraTablero, Indicador } from "@/components/tablero";

export default async function PanelSistemaVistaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoSeccion("Panel — Sistema", session, await headers());
    redirect("/correspondencia/panel");
  }

  const s = await obtenerPanelSistemaVista();

  return (
    <section className="space-y-4">
      <CabeceraTablero antetitulo="Últimos 30 días" titulo="Sistema" descripcion="Incidencias registradas en la bitácora del SGDEA.">
        <Indicador icon={ShieldAlert} valor={s.accesosFallidos30} etiqueta="Accesos fallidos" tono={s.accesosFallidos30 > 0 ? "rojo" : "neutro"} />
        <Indicador icon={FileWarning} valor={s.carguesFallidos30} etiqueta="Cargues fallidos" tono={s.carguesFallidos30 > 0 ? "ambar" : "neutro"} />
        <Indicador icon={AlertTriangle} valor={s.erroresEjecucion30} etiqueta="Errores de ejecución" tono={s.erroresEjecucion30 > 0 ? "ambar" : "neutro"} />
      </CabeceraTablero>

      {s.incidenciasRecientes > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" aria-hidden />
          {s.incidenciasRecientes === 1
            ? "1 falla del sistema (error de ejecución o cargue rechazado) en las últimas 24 horas."
            : `${s.incidenciasRecientes} fallas del sistema (errores de ejecución o cargues rechazados) en las últimas 24 horas.`}{" "}
          Revíselas en la Bitácora.
        </div>
      )}

      <p className="text-xs text-stone-400">
        <History className="mr-1 inline h-3 w-3" aria-hidden />
        El detalle de cada evento está en la{" "}
        <Link href="/correspondencia/bitacora" className="font-medium text-cdmb-700 hover:underline">
          Bitácora
        </Link>
        .
      </p>
    </section>
  );
}
