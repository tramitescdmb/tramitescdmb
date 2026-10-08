import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar } from "@/lib/permisos";
import { TerceroForm } from "@/components/TerceroForm";
import { nombreTercero, personaDesdeTercero } from "@/lib/terceros";
import { formatearFecha } from "@/lib/fecha";

export default async function TerceroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const tercero = await db.tercero.findUnique({
    where: { id },
    include: {
      comunicaciones: {
        orderBy: { fechaRadicacion: "desc" },
        take: 50,
        select: { id: true, radicado: true, tipo: true, asunto: true, estado: true, fechaRadicacion: true },
      },
      _count: { select: { comunicaciones: true } },
    },
  });
  if (!tercero) notFound();
  const editable = puedeRadicar(permisos);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/correspondencia/terceros" className="text-sm text-cdmb-700 hover:underline">
          ← Terceros
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">{nombreTercero(tercero)}</h1>
        <p className="text-sm text-stone-500">
          {tercero.tipoIdentificacion ?? "Documento"} {tercero.identificacion} · {tercero.tipo === "JURIDICA" ? "Persona jurídica" : "Persona natural"}
        </p>
      </div>

      {editable ? (
        <TerceroForm terceroId={tercero.id} inicial={personaDesdeTercero(tercero)} />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm shadow-soft sm:grid-cols-4">
          <div>
            <dt className="text-xs text-stone-400">Correo</dt>
            <dd className="break-all">{tercero.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Celular / teléfono</dt>
            <dd>{[tercero.celular, tercero.telefono].filter(Boolean).join(" · ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Ciudad</dt>
            <dd>{[tercero.ciudad, tercero.departamento].filter(Boolean).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Dirección</dt>
            <dd>{tercero.direccion ?? "—"}</dd>
          </div>
        </dl>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Comunicaciones ({tercero._count.comunicaciones})</h2>
        {tercero.comunicaciones.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-400 shadow-soft">Sin comunicaciones radicadas.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-soft">
            <table className="w-full text-xs">
              <thead className="border-b border-stone-100 text-left text-[11px] uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Radicado</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Asunto</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tercero.comunicaciones.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2 font-mono">
                      <Link href={`/correspondencia/${c.id}`} className="text-cdmb-700 hover:underline">
                        {c.radicado}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-stone-500">{c.tipo === "RECIBIDA" ? "Recibida" : c.tipo === "ENVIADA" ? "Enviada" : "Interna"}</td>
                    <td className="max-w-md truncate px-3 py-2 text-stone-700" title={c.asunto}>
                      {c.asunto}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-stone-500">{formatearFecha(c.fechaRadicacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
