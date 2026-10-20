import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { listarPerfiles } from "@/lib/perfiles";
import { ETIQUETA_MODULO_PERFIL, MODULOS_PERFIL } from "@/lib/perfiles-catalogo";
import { NuevoPerfilForm } from "@/components/admin/NuevoPerfilForm";
import { AsignarSegunRolesBoton } from "@/components/admin/AsignarSegunRolesBoton";

export default async function PerfilesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Perfiles y permisos" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;

  const perfiles = await listarPerfiles();
  const asignaciones = perfiles.reduce((t, p) => t + p.usuariosAsignados, 0);

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={ShieldCheck}
        titulo="Perfiles y permisos"
        descripcion="Cada perfil define qué puede ver, crear, editar o eliminar en cada funcionalidad. Los perfiles iniciales reproducen los roles actuales."
      />

      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Etapa de preparación: los accesos de los usuarios todavía salen de sus roles actuales. Los perfiles se pueden revisar y ajustar desde ya;
        se aplicarán módulo por módulo cuando se active cada uno.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-4 py-3">
        <p className="text-sm text-stone-600">
          {asignaciones > 0
            ? `${asignaciones} asignación(es) de perfil a usuarios.`
            : "Ningún usuario tiene perfiles asignados todavía."}{" "}
          Puede asignarlos uno a uno desde la ficha del usuario o de una vez según sus roles actuales.
        </p>
        <AsignarSegunRolesBoton />
      </div>

      {MODULOS_PERFIL.map((m) => {
        const delModulo = perfiles.filter((p) => p.modulo === m);
        if (delModulo.length === 0) return null;
        return (
          <section key={m} className="overflow-hidden rounded-md border border-stone-200 bg-white">
            <h2 className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-900">
              {ETIQUETA_MODULO_PERFIL[m]}
              <span className="rounded-sm bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-800">{delModulo.length}</span>
            </h2>
            <table className="tabla-listado w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2">Perfil</th>
                  <th className="w-24 px-3 py-2 text-right">Permisos</th>
                  <th className="w-36 px-3 py-2 text-right">Con el rol hoy</th>
                  <th className="w-28 px-3 py-2 text-right">Asignados</th>
                  <th className="w-48 px-4 py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                {delModulo.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 align-top">
                      <Link href={`/admin/perfiles/${p.id}`} className="font-medium text-cdmb-700 hover:underline">
                        {p.nombre}
                      </Link>
                      {p.descripcion && <span className="block text-xs text-stone-500">{p.descripcion}</span>}
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-stone-700">{p.acciones}</td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-stone-700">{p.usuariosConRol ?? "—"}</td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-stone-700">{p.usuariosAsignados}</td>
                    <td className="px-4 py-2 align-top text-xs">
                      {p.claveOrigen ? (
                        <span className={p.modificado ? "font-medium text-amber-700" : "text-stone-500"}>
                          {p.modificado ? "Rol actual, con cambios" : "Igual al rol actual"}
                        </span>
                      ) : (
                        <span className="text-stone-500">Creado por el administrador</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <NuevoPerfilForm
        modulos={MODULOS_PERFIL.map((m) => ({ valor: m, etiqueta: ETIQUETA_MODULO_PERFIL[m] }))}
        perfiles={perfiles.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    </div>
  );
}
