import Link from "next/link";
import { db } from "@/lib/db";
import { SectionHelp } from "@/components/Field";

const ESTADOS_ACTIVOS = ["RADICADO", "EN_TRAMITE", "INFORMACION_ADICIONAL_REQUERIDA", "SUSPENDIDO"];

export default async function CatalogoTramitesPage() {
  const [tramites, porEstado] = await Promise.all([
    db.tramiteTipo.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: { _count: { select: { flujos: true, expedientes: true } } },
    }),
    db.expediente.groupBy({ by: ["tramiteTipoId", "estado"], _count: { _all: true } }),
  ]);

  const conteoPorTramite = new Map<string, { activos: number; aprobados: number; negados: number }>();
  for (const row of porEstado) {
    const actual = conteoPorTramite.get(row.tramiteTipoId) ?? { activos: 0, aprobados: 0, negados: 0 };
    if (ESTADOS_ACTIVOS.includes(row.estado)) actual.activos += row._count._all;
    else if (row.estado === "APROBADO") actual.aprobados += row._count._all;
    else if (row.estado === "NEGADO" || row.estado === "RECHAZADO") actual.negados += row._count._all;
    conteoPorTramite.set(row.tramiteTipoId, actual);
  }

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
        necesita para radicarlo y por qué pasos avanza). Los números de abajo son los expedientes de ese
        trámite: cuántos están <strong>activos</strong> ahora mismo, cuántos ya quedaron{" "}
        <strong>aprobados</strong> y cuántos <strong>negados/rechazados</strong>. Entra a un trámite para
        ver el detalle completo y, desde ahí, iniciar un expediente nuevo.
      </SectionHelp>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tramites.map((t) => {
          const conteo = conteoPorTramite.get(t.id);
          return (
            <Link
              key={t.id}
              href={`/tramites/${t.slug}`}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-cdmb-300 hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                  {t.codigo} · v{t.version}
                </span>
                <span className="text-xs text-gray-400">
                  {t._count.flujos} flujo{t._count.flujos === 1 ? "" : "s"}
                </span>
              </div>

              <h2 className="font-medium leading-snug text-gray-900">{t.nombre}</h2>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-gray-500">{t.objeto}</p>

              <p className="mt-3 text-xs text-gray-400">{t.proceso}</p>

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                {!conteo && <span className="text-xs text-gray-300">Sin expedientes todavía</span>}
                {conteo && conteo.activos > 0 && (
                  <CountPill color="amber" value={conteo.activos} label="activo" />
                )}
                {conteo && conteo.aprobados > 0 && (
                  <CountPill color="green" value={conteo.aprobados} label="aprobado" />
                )}
                {conteo && conteo.negados > 0 && (
                  <CountPill color="red" value={conteo.negados} label="negado" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CountPill({ value, label, color }: { value: number; label: string; color: "amber" | "green" | "red" }) {
  const classes = {
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
  }[color];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {value} {label}
      {value === 1 ? "" : "s"}
    </span>
  );
}
