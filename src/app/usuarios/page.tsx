import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Field, SectionHelp } from "@/components/Field";
import { IconUser, IconMail, IconLock, IconShieldCheck, IconBriefcase } from "@/components/icons";

const iconSm = "h-4 w-4";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { error, ok } = await searchParams;
  const [usuarios, cargos] = await Promise.all([
    db.usuario.findMany({ orderBy: { createdAt: "asc" }, include: { cargo: true } }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
        ingresan con las credenciales de la red de la CDMB; su contraseña no se administra aquí. Puede
        asignarles el cargo y, si corresponde, cambiarles el rol.
      </SectionHelp>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">Correo</th>
              <th className="px-4 py-2.5 font-medium">Cargo</th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5 text-stone-800">
                  {u.nombre}
                  {u.directorioActivo && (
                    <span className="ml-2 rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700">
                      Directorio activo
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{u.email}</td>
                <td className="px-4 py-2.5 text-stone-600">{u.cargo?.nombre ?? "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">{u.rol === "ADMIN" ? "Administrador" : "Funcionario"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.id !== session.userId && (
                    <form action={`/api/usuarios/${u.id}/toggle`} method="post">
                      <button className="text-xs text-stone-500 hover:text-cdmb-700 hover:underline">
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Crear usuario nuevo</h2>
        <form action="/api/usuarios" method="post" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Field
            label="Cargo en la CDMB"
            icon={<IconBriefcase className={iconSm} />}
            help="Su puesto real (Subdirector, Profesional en Derecho, etc.). Se usa para resaltarle qué pasos de un trámite le corresponden — no es obligatorio."
          >
            <select
              name="cargoId"
              defaultValue=""
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            >
              <option value="">Sin especificar</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
            >
              Crear usuario
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
