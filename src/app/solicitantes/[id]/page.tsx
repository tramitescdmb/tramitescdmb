import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EstadoBadge } from "@/components/EstadoBadge";
import { EditarSolicitanteForm } from "@/components/EditarSolicitanteForm";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";
import { nombreCompletoSolicitante } from "@/lib/solicitante";

export default async function SolicitanteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const solicitante = await db.solicitante.findUnique({
    where: { id },
    include: {
      expedientes: {
        orderBy: { fechaUltimoMovimiento: "desc" },
        include: { tramiteTipo: true },
      },
    },
  });

  if (!solicitante) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/solicitantes" className="text-sm text-cdmb-700 hover:underline">
          ← Solicitantes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-stone-900">{nombreCompletoSolicitante(solicitante)}</h1>
          {solicitante.granContribuyente && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Gran contribuyente
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500">
          {solicitante.tipo === "JURIDICA" ? "NIT" : "Cédula de ciudadanía"}: {solicitante.identificacion} ·{" "}
          {solicitante.tipo === "JURIDICA" ? "Persona jurídica" : "Persona natural"}
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Datos de contacto</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          {solicitante.tipo === "JURIDICA" ? (
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Razón social</dt>
              <dd className="break-words text-stone-800">{solicitante.razonSocial ?? "—"}</dd>
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Nombres</dt>
                <dd className="break-words text-stone-800">{solicitante.nombres ?? "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-stone-400">Apellidos</dt>
                <dd className="break-words text-stone-800">{solicitante.apellidos ?? "—"}</dd>
              </div>
            </>
          )}
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Correo</dt>
            <dd className="break-all text-stone-800">{solicitante.email ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Teléfono</dt>
            <dd className="break-words text-stone-800">{solicitante.telefono ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Municipio</dt>
            <dd className="break-words text-stone-800">{solicitante.municipio}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Dirección</dt>
            <dd className="break-words text-stone-800">{solicitante.direccion ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Régimen tributario</dt>
            <dd className="break-words text-stone-800">{regimenTributarioLabel(solicitante.regimenTributario)}</dd>
          </div>
        </dl>

        {session?.rol === "ADMIN" && (
          <EditarSolicitanteForm
            solicitante={{
              id: solicitante.id,
              tipo: solicitante.tipo,
              nombres: solicitante.nombres,
              apellidos: solicitante.apellidos,
              razonSocial: solicitante.razonSocial,
              email: solicitante.email,
              telefono: solicitante.telefono,
              direccion: solicitante.direccion,
              municipio: solicitante.municipio,
              regimenTributario: solicitante.regimenTributario,
              granContribuyente: solicitante.granContribuyente,
            }}
          />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Expedientes de este solicitante ({solicitante.expedientes.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {solicitante.expedientes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-stone-400">Todavía no tiene expedientes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Número</th>
                  <th className="px-4 py-2.5 font-medium">Trámite</th>
                  <th className="px-4 py-2.5 font-medium">Municipio</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Último movimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {solicitante.expedientes.map((exp) => (
                  <tr key={exp.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/expedientes/${exp.id}`} className="font-medium text-cdmb-700 hover:underline">
                        {exp.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-stone-700">{exp.tramiteTipo.nombre}</td>
                    <td className="px-4 py-2.5 text-stone-500">{exp.municipio}</td>
                    <td className="px-4 py-2.5">
                      <EstadoBadge estado={exp.estado} />
                    </td>
                    <td className="px-4 py-2.5 text-stone-500">
                      {exp.fechaUltimoMovimiento.toLocaleDateString("es-CO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
