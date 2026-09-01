import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

function ListaCampos({ datos }: { datos: unknown }) {
  if (!datos || typeof datos !== "object") {
    return <p className="text-sm text-stone-400">Sin datos.</p>;
  }
  const entradas = Object.entries(datos as Record<string, unknown>).filter(([, v]) => v != null && v !== "");
  if (entradas.length === 0) {
    return <p className="text-sm text-stone-400">Sin datos.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      {entradas.map(([campo, valor]) => (
        <div key={campo} className="min-w-0">
          <dt className="text-xs text-stone-400">{campo}</dt>
          <dd className="break-words text-stone-800">
            {typeof valor === "object" ? JSON.stringify(valor) : String(valor)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function VitalDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const solicitud = await db.solicitudVital.findUnique({
    where: { id },
    include: { documentos: { orderBy: { createdAt: "desc" } } },
  });
  if (!solicitud) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vital" className="text-sm text-cdmb-700 hover:underline">
          ← VITAL
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">Solicitud VITAL {solicitud.idVital}</h1>
        <p className="text-sm text-stone-500">
          id_tramite {solicitud.idTramiteVital}
          {solicitud.idTramiteAutoridad ? ` · idTramiteAutoridad ${solicitud.idTramiteAutoridad}` : ""} ·{" "}
          {solicitud.nombreActividad ?? "Sin actividad reportada"}
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Solicitante</h2>
        <dl className="mb-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-400">Nombre / razón social</dt>
            <dd className="text-stone-800">{solicitud.solicitanteNombre ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Identificación</dt>
            <dd className="text-stone-800">{solicitud.solicitanteIdentificacion ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Correo</dt>
            <dd className="text-stone-800">{solicitud.solicitanteCorreo ?? "—"}</dd>
          </div>
        </dl>
        <details className="border-t border-stone-100 pt-3">
          <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
            Ver todos los datos que envió VITAL
          </summary>
          <div className="mt-2 space-y-4">
            {Array.isArray(solicitud.solicitanteRaw) ? (
              (solicitud.solicitanteRaw as unknown[]).map((interesado, i) => (
                <div key={i}>
                  {(solicitud.solicitanteRaw as unknown[]).length > 1 && (
                    <p className="mb-1 text-xs font-semibold text-stone-500">Interesado {i + 1}</p>
                  )}
                  <ListaCampos datos={interesado} />
                </div>
              ))
            ) : (
              <ListaCampos datos={solicitud.solicitanteRaw} />
            )}
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Campos del formulario del trámite</h2>
        <ListaCampos datos={solicitud.camposTramite} />
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Documentos adjuntos</h2>
        {solicitud.documentos.length === 0 ? (
          <p className="text-sm text-stone-400">Sin documentos.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {solicitud.documentos.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-2 text-sm">
                <a
                  href={`/api/vital-documentos/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-cdmb-700 hover:underline"
                >
                  📄 {doc.nombre}
                </a>
                <span className="text-xs text-stone-400">{doc.createdAt.toLocaleDateString("es-CO")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-stone-400">
        Última sincronización con VITAL: {solicitud.ultimaSincronizacion.toLocaleString("es-CO")}
      </p>
    </div>
  );
}
