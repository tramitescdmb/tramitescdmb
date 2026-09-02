import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Field, SectionHelp } from "@/components/Field";
import { IconUser, IconMail, IconLock, IconShieldCheck } from "@/components/icons";
import { EditarUsuarioForm } from "@/components/EditarUsuarioForm";
import { UserPlus, Briefcase } from "lucide-react";

const iconSm = "h-4 w-4";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { error, ok } = await searchParams;
  const [usuarios, cargos, roles] = await Promise.all([
    db.usuario.findMany({ orderBy: { createdAt: "asc" }, include: { cargos: true, rolPermisos: true } }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
    db.rol.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Usuarios</h1>
        <p className="text-sm text-stone-500">
          Funcionarios de la CDMB que pueden ingresar a esta aplicación para gestionar trámites.
        </p>
      </div>

      <SectionHelp>
        Rol <strong>Administrador</strong>: además de gestionar expedientes, puede crear otros usuarios y
        desactivarlos. Rol <strong>Funcionario</strong>: puede crear y avanzar expedientes, pero no
        administra usuarios.
        <br />
        Los usuarios marcados como <strong>Directorio activo</strong> se crean solos la primera vez que
        ingresan con las credenciales de la red de la CDMB; su contraseña no se administra aquí. Use
        &quot;Editar&quot; en cualquier usuario para asignarle uno o varios cargos, cambiarle el rol, o
        darle un <strong>Rol de acceso</strong> — creado en la sección{" "}
        <Link href="/roles" className="underline hover:text-cdmb-700">Roles</Link>, define a qué
        trámites de Trámites ambientales 2.0 puede entrar. Sin un Rol de acceso asignado, el usuario
        no tiene restricción.
      </SectionHelp>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-stone-100 bg-stone-50/80 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Cargo(s)</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Rol de acceso</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-stone-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-800">
                      {iniciales(u.nombre)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-stone-800">
                        {u.nombre}
                        {u.directorioActivo && (
                          <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">
                            Directorio activo
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-stone-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.cargos.length === 0 ? (
                    <span className="text-xs text-stone-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.cargos.map((c) => (
                        <span key={c.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                          {c.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.rol === "ADMIN" ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {u.rol === "ADMIN" ? "Administrador" : "Funcionario"}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-600">{u.rolPermisos?.nombre ?? "Sin restricción"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <EditarUsuarioForm
                      usuarioId={u.id}
                      nombreUsuario={u.nombre}
                      rolActual={u.rol}
                      cargoActualIds={u.cargos.map((c) => c.id)}
                      rolPermisosActualId={u.rolPermisosId}
                      cargos={cargos.map((c) => ({ id: c.id, nombre: c.nombre }))}
                      roles={roles.map((r) => ({ id: r.id, nombre: r.nombre }))}
                    />
                    {u.id !== session.userId && (
                      <form action={`/api/usuarios/${u.id}/toggle`} method="post">
                        <button className="text-xs text-stone-500 hover:text-cdmb-700 hover:underline">
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <UserPlus className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold text-stone-900">Crear usuario nuevo</h2>
        </div>
        <form action="/api/usuarios" method="post" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" required icon={<IconUser className={iconSm} />} help="Como debe aparecer en la bitácora de los expedientes.">
              <input
                name="nombre"
                required
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Correo institucional" required icon={<IconMail className={iconSm} />} help="Con este correo va a iniciar sesión.">
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="nombre@cdmb.gov.co"
              />
            </Field>
            <Field label="Contraseña temporal" required icon={<IconLock className={iconSm} />} help="Mínimo 8 caracteres. El usuario la puede cambiar después.">
              <input
                type="password"
                name="password"
                required
                minLength={8}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Rol" required icon={<IconShieldCheck className={iconSm} />} help="Qué puede hacer este usuario dentro de la app.">
              <select
                name="rol"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              >
                <option value="FUNCIONARIO">Funcionario</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </Field>
          </div>

          <Field
            label="Cargo(s) en la CDMB"
            icon={<Briefcase className={iconSm} />}
            help="Su(s) puesto(s) real(es) (Subdirector, Profesional en Derecho, etc.). Se usan para resaltarle qué pasos de un trámite le corresponden. Puede marcar uno, varios, o ninguno."
          >
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-stone-50/60 p-2.5">
              {cargos.map((c) => (
                <label key={c.id} className="cursor-pointer">
                  <input type="checkbox" name="cargoIds" value={c.id} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 transition hover:border-cdmb-300 hover:text-cdmb-700 peer-checked:border-cdmb-600 peer-checked:bg-cdmb-600 peer-checked:text-white">
                    {c.nombre}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <button
            type="submit"
            className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95"
          >
            Crear usuario
          </button>
        </form>
      </section>
    </div>
  );
}
