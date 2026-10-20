import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { listarPerfiles } from "@/lib/perfiles";
import { ETIQUETA_MODULO_PERFIL, MODULOS_PERFIL } from "@/lib/perfiles-catalogo";
import { NuevoPerfilForm } from "@/components/admin/NuevoPerfilForm";

const MODULOS_ROLES = MODULOS_PERFIL.filter((m) => m !== "GENERAL");

export default async function RolesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Roles" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;

  const roles = (await listarPerfiles()).filter((p) => p.modulo !== "GENERAL");

  return (
    <div className="space-y-4">
      <CabeceraTablero icon={ShieldCheck} titulo="Roles" descripcion="Opciones que concede cada rol. Se asignan desde la ficha de cada usuario." />

      {MODULOS_ROLES.map((m) => {
        const delModulo = roles.filter((p) => p.modulo === m);
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
                  <th className="px-4 py-2">Rol</th>
                  <th className="w-32 px-3 py-2 text-right">Permisos</th>
                  <th className="w-32 px-4 py-2 text-right">Usuarios</th>
                </tr>
              </thead>
              <tbody>
                {delModulo.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 align-top">
                      <Link href={`/admin/roles/${p.id}`} className="font-medium text-cdmb-700 hover:underline">
                        {p.nombre}
                      </Link>
                      {p.descripcion && <span className="block text-xs text-stone-500">{p.descripcion}</span>}
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-stone-700">{p.acciones}</td>
                    <td className="px-4 py-2 text-right align-top tabular-nums text-stone-700">{p.usuariosAsignados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <NuevoPerfilForm
        modulos={MODULOS_ROLES.map((m) => ({ valor: m, etiqueta: ETIQUETA_MODULO_PERFIL[m] }))}
        perfiles={roles.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    </div>
  );
}
