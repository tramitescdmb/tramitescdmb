import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { conceptosDevueltosA, conceptosPorRevisar } from "@/lib/revision-concepto";
import { formatearFechaHora } from "@/lib/fecha";
import { CabeceraTablero } from "@/components/tablero";

type Fila = Awaited<ReturnType<typeof conceptosPorRevisar>>[number] & { revisiones: { createdAt: Date; comentario?: string | null; usuario: { nombre: string } }[] };

function Tabla({ filas, vacio, conObservacion }: { filas: Fila[]; vacio: string; conObservacion?: boolean }) {
  if (filas.length === 0) return <p className="rounded-xl border border-dashed border-stone-200 bg-white p-4 text-center text-sm text-stone-400">{vacio}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
            <th className="px-4 py-2 font-medium">Expediente</th>
            <th className="px-2 py-2 font-medium">Visita</th>
            <th className="px-4 py-2 font-medium">{conObservacion ? "Observaciones" : "Enviado"}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const ultima = f.revisiones[0];
            return (
              <tr key={f.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/expedientes/${f.expediente.id}/visitas/${f.visitaProgramadaId}/formato`} className="font-mono text-xs font-medium text-cdmb-700 hover:underline">
                    {f.expediente.numero}
                  </Link>
                  <span className="block text-xs text-stone-500">{f.expediente.tramiteTipo.nombre}</span>
                </td>
                <td className="px-2 py-2 text-xs text-stone-600">
                  {f.visitaProgramada?.lugar}
                  <span className="block text-stone-400">{f.visitaProgramada?.profesional.nombre}{f.conceptoNumero ? ` · ${f.conceptoNumero}` : ""}</span>
                </td>
                <td className="px-4 py-2 text-xs text-stone-600">
                  {ultima ? (
                    <>
                      {conObservacion && ultima.comentario ? <span className="block text-stone-800">{ultima.comentario}</span> : null}
                      <span className="text-stone-400">
                        {ultima.usuario.nombre} · {formatearFechaHora(ultima.createdAt)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function ConceptosPorRevisarPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const planificador = puedePlanearVisitas(permisos);
  const [porRevisar, devueltos] = await Promise.all([planificador ? conceptosPorRevisar(permisos) : Promise.resolve([]), conceptosDevueltosA(session.userId)]);

  return (
    <div className="space-y-4">
      <CabeceraTablero icon={ClipboardCheck} titulo="Conceptos técnicos en revisión" descripcion="Conceptos enviados a revisión y conceptos devueltos con observaciones." />
      {planificador && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-900">Por revisar ({porRevisar.length})</h3>
          <Tabla filas={porRevisar as Fila[]} vacio="No hay conceptos esperando revisión." />
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-stone-900">Devueltos a usted para corrección ({devueltos.length})</h3>
        <Tabla filas={devueltos as Fila[]} vacio="No tiene conceptos devueltos." conObservacion />
      </section>
    </div>
  );
}
