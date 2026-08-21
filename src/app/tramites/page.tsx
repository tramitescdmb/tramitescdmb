import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHelp } from "@/components/Field";

export default async function CatalogoTramitesPage() {
  const tramites = await db.tramiteTipo.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    include: { _count: { select: { flujos: true, expedientes: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Catálogo de trámites</h1>
        <p className="text-sm text-gray-500">
          Los {tramites.length} trámites ambientales que atiende la CDMB, tomados de sus procedimientos oficiales.
        </p>
      </div>

      <SectionHelp>
        Cada tarjeta es un <strong>tipo de trámite</strong> (el procedimiento oficial: qué es, qué se
        necesita para radicarlo y por qué pasos avanza). Entra a un trámite para ver el detalle completo
        y, desde ahí, iniciar un <strong>expediente</strong> nuevo (el caso concreto de un solicitante).
      </SectionHelp>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tramites.map((t) => (
          <Link
            key={t.id}
            href={`/tramites/${t.slug}`}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition hover:border-cdmb-300 hover:shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                {t.codigo} · v{t.version}
              </span>
              {t._count.expedientes > 0 && (
                <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700">
                  {t._count.expedientes} expediente{t._count.expedientes === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <h2 className="font-medium text-gray-900">{t.nombre}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{t.objeto}</p>
            <p className="mt-3 text-xs text-gray-400">
              {t._count.flujos} flujo{t._count.flujos === 1 ? "" : "s"} de trámite · {t.proceso}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
