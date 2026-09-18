import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature, Eye } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { db } from "@/lib/db";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { formatearFechaHoraLarga } from "@/lib/fecha";

/** Historial de TODOS los documentos que el usuario ha firmado en SIGEC — antes solo se podía ver
 * una firma propia entrando al expediente correspondiente y buscándola; no había un lugar único. */
export default async function MisFirmasContratacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const firmas = await db.firmaDocumentoContrato.findMany({
    where: { usuarioId: session.userId },
    orderBy: { fechaHora: "desc" },
    select: {
      id: true,
      fechaHora: true,
      hashContenido: true,
      documento: { select: { nombre: true, expedienteId: true, expediente: { select: { numero: true, objeto: true } } } },
    },
  });

  return (
    <section className="space-y-4">
      <TituloSeccion icon={FileSignature}>Mis firmas</TituloSeccion>

      {firmas.length === 0 ? (
        <EstadoVacio icon={FileSignature}>Todavía no ha firmado ningún documento en SIGEC.</EstadoVacio>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
          {firmas.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{f.documento.nombre}</p>
                <p className="truncate text-xs text-stone-400">
                  Expediente {f.documento.expediente.numero} · {f.documento.expediente.objeto}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-stone-400">
                  {formatearFechaHoraLarga(f.fechaHora)} · SHA-256 {f.hashContenido.slice(0, 16)}…
                </p>
              </div>
              <Link
                href={`/contratacion/expedientes/${f.documento.expedienteId}/ficha-firma`}
                className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Ver ficha técnica
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
