import { db } from "@/lib/db";
import { formatearFechaHora } from "@/lib/fecha";

export const dynamic = "force-dynamic";

const ACCION: Record<string, string> = { CREA: "Creó", MODIFICA: "Editó", ELIMINA: "Eliminó", EXPORTA: "Exportó", LEE: "Consultó" };
const ENTIDAD: Record<string, string> = { NvNegocio: "Negocio", NvPersona: "Persona", NvTaxonomia: "Clasificación", NvBanner: "Banner", NvConfiguracion: "Apariencia" };

/** Últimas acciones registradas en Negocios Verdes (registro de auditoría encadenado del SIC). */
export default async function AuditoriaNegociosVerdes() {
  const filas = await db.auditoriaDoc.findMany({
    where: { entidad: { startsWith: "Nv" } },
    orderBy: { secuencia: "desc" },
    take: 200,
    select: { id: true, entidad: true, accion: true, detalle: true, createdAt: true, usuario: { select: { nombre: true, email: true } } },
  });
  if (filas.length === 0) return <p className="flex min-h-[60dvh] items-center justify-center text-sm">Todavía no hay acciones registradas.</p>;
  return (
    <div>
      <p className="mb-3 text-[13px] text-nv-texto2">Las 200 acciones más recientes. El registro completo y su verificación están en la auditoría del SIC.</p>
      <ul className="divide-y divide-nv-borde rounded-[12px] border border-nv-borde bg-white">
        {filas.map((f) => (
          <li key={f.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <time className="w-36 flex-none text-xs text-nv-texto2" dateTime={f.createdAt.toISOString()}>
              {formatearFechaHora(f.createdAt)}
            </time>
            <span className="w-24 flex-none rounded-[6px] bg-nv-claro px-2 py-0.5 text-center text-xs text-nv-primario">{ENTIDAD[f.entidad] ?? f.entidad}</span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{ACCION[f.accion] ?? f.accion}</span> · {f.detalle ?? "—"}
            </span>
            <span className="text-xs text-nv-texto2">{f.usuario?.email ?? "Sistema"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
