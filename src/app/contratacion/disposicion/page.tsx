import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { SectionHelp } from "@/components/Field";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { contratosEnDisposicion } from "@/lib/trd-disposicion-modulos";
import { ETIQUETA_FASE, type FaseArchivistica } from "@/lib/disposicion-final";
import { formatearFecha } from "@/lib/fecha";

const ORDEN_FASE: FaseArchivistica[] = ["DISPOSICION_PENDIENTE", "TRANSFERENCIA_PENDIENTE", "GESTION"];

export default async function DisposicionContratosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Disposición final" volverHref="/contratacion/panel" volverLabel="Ir al panel" />;

  const { clasificados, sinClasificar } = await contratosEnDisposicion();
  const porFase = new Map<FaseArchivistica, typeof clasificados>();
  for (const e of clasificados) {
    const lista = porFase.get(e.fase) ?? [];
    lista.push(e);
    porFase.set(e.fase, lista);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Disposición final de contratos</h1>
        <p className="text-sm text-stone-500">
          Solo expedientes contractuales cerrados. Requiere haber asignado la subserie de contratación en{" "}
          <Link href="/admin/trd" className="text-cdmb-700 hover:underline">Clasificación TRD</Link>.
        </p>
      </div>

      {sinClasificar > 0 && (
        <SectionHelp>
          {sinClasificar} contrato{sinClasificar === 1 ? "" : "s"} cerrado{sinClasificar === 1 ? "" : "s"} no aparece
          {sinClasificar === 1 ? "" : "n"} aquí porque la subserie de contratación todavía no está asignada.
        </SectionHelp>
      )}

      {ORDEN_FASE.map((fase) => {
        const lista = porFase.get(fase) ?? [];
        if (lista.length === 0) return null;
        return (
          <section key={fase} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
            <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
              <Archive className="h-4 w-4 text-cdmb-600" aria-hidden />
              <h2 className="text-sm font-semibold text-stone-900">{ETIQUETA_FASE[fase]}</h2>
              <span className="text-xs text-stone-400">{lista.length}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Contrato</th>
                  <th className="px-4 py-2 font-medium">Cierre</th>
                  <th className="px-4 py-2 font-medium">Fin gestión</th>
                  <th className="px-4 py-2 font-medium">Fin archivo central</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <Link href={`/contratacion/expedientes/${e.id}`} className="font-medium text-cdmb-700 hover:underline">
                        {e.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-stone-600">{formatearFecha(e.fechaCierre)}</td>
                    <td className="px-4 py-2 text-stone-600">{formatearFecha(e.fechaFinGestion)}</td>
                    <td className="px-4 py-2 text-stone-600">{formatearFecha(e.fechaFinCentral)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {clasificados.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-white shadow-soft p-8 text-center text-sm text-stone-400">
          Sin contratos clasificados con fecha de cierre todavía.
        </p>
      )}
    </div>
  );
}
