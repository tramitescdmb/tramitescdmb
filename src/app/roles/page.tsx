import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SectionHelp } from "@/components/Field";

export default async function RolesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const roles = await db.rol.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { usuarios: true, tramites: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Roles</h1>
          <p className="text-sm text-stone-500">
            Roles de acceso: a qué trámites de &quot;Trámites ambientales 2.0&quot; puede entrar un
            funcionario. Se asignan desde{" "}
            <Link href="/usuarios" className="text-cdmb-700 hover:underline">Usuarios</Link>.
          </p>
        </div>
        <Link
          href="/roles/nuevo"
          className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
        >
          + Crear rol
        </Link>
      </div>

      <SectionHelp>
        Un funcionario sin ningún rol de acceso asignado no tiene restricción — entra a todo, como hoy.
        El control solo aplica a quien tenga un rol asignado explícitamente, y solo dentro de
        &quot;Trámites ambientales 2.0&quot; — VITAL y SINCA 1.0 quedan siempre abiertos.
      </SectionHelp>

      {roles.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-10 text-center text-sm text-stone-400">
          Todavía no hay roles creados.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Trámites</th>
                <th className="px-4 py-2.5 font-medium">Usuarios</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {roles.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-stone-800">
                    {r.nombre}
                    {r.descripcion && <p className="text-xs text-stone-400">{r.descripcion}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {r.todosLosTramites ? "Todos" : `${r._count.tramites} trámite${r._count.tramites === 1 ? "" : "s"}`}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{r._count.usuarios}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {r.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/roles/${r.id}`} className="text-xs text-stone-500 hover:text-cdmb-700 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
