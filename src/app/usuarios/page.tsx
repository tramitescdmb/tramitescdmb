import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Field, SectionHelp } from "@/components/Field";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { error, ok } = await searchParams;
  const usuarios = await db.usuario.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500">
          Funcionarios de la CDMB que pueden ingresar a esta aplicación para gestionar trámites.
        </p>
      </div>

      <SectionHelp>
        Rol <strong>Administrador</strong>: además de gestionar expedientes, puede crear otros usuarios y
        desactivarlos. Rol <strong>Funcionario</strong>: puede crear y avanzar expedientes, pero no
        administra usuarios.
      </SectionHelp>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">Correo</th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5 text-gray-800">{u.nombre}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.rol === "ADMIN" ? "Administrador" : "Funcionario"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.activo ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.id !== session.userId && (
                    <form action={`/api/usuarios/${u.id}/toggle`} method="post">
                      <button className="text-xs text-gray-500 hover:text-cdmb-700 hover:underline">
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

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Crear usuario nuevo</h2>
        <form action="/api/usuarios" method="post" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" required help="Como debe aparecer en la bitácora de los expedientes.">
            <input
              name="nombre"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <Field label="Correo institucional" required help="Con este correo va a iniciar sesión.">
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="nombre@cdmb.gov.co"
            />
          </Field>
          <Field label="Contraseña temporal" required help="Mínimo 8 caracteres. El usuario la puede cambiar después.">
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <Field label="Rol" required help="Qué puede hacer este usuario dentro de la app.">
            <select
              name="rol"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            >
              <option value="FUNCIONARIO">Funcionario</option>
              <option value="ADMIN">Administrador</option>
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
