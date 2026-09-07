import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, FolderCheck, Plus } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { listarExpedientesDocumentales } from "@/lib/expedientes-documentales";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { SectionHelp } from "@/components/Field";
import type { EstadoExpedienteDocumental } from "@prisma/client";

const fecha = (d: Date) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export default async function ExpedientesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const estado: EstadoExpedienteDocumental | undefined =
    sp.estado === "ABIERTO" || sp.estado === "CERRADO" ? sp.estado : undefined;
  const expedientes = await listarExpedientesDocumentales({ estado });

  const filtros = [
    { valor: undefined, label: "Todos" },
    { valor: "ABIERTO" as const, label: "Abiertos" },
    { valor: "CERRADO" as const, label: "Cerrados" },
  ];

  return (
    <div className="space-y-4">
      <SectionHelp>
        Carpeta digital de un asunto o procedimiento — no requiere originarse en una comunicación radicada
        (Art. 4.3.2 Acuerdo 001/2024 AGN).
      </SectionHelp>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1 text-sm">
          {filtros.map((f) => (
            <Link
              key={f.label}
              href={f.valor ? `/correspondencia/expedientes?estado=${f.valor}` : "/correspondencia/expedientes"}
              className={`rounded-md px-3 py-1.5 font-medium ${
                estado === f.valor ? "bg-cdmb-600 text-white" : "text-stone-500 hover:bg-stone-50"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <Link
          href="/correspondencia/expedientes/nuevo"
          className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nuevo expediente
        </Link>
      </div>

      {expedientes.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
          No hay expedientes {estado === "ABIERTO" ? "abiertos" : estado === "CERRADO" ? "cerrados" : "todavía"}.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Número</th>
                <th className="px-4 py-2 font-medium">Asunto</th>
                <th className="px-4 py-2 font-medium">Dependencia</th>
                <th className="px-4 py-2 font-medium">Clasificación</th>
                <th className="px-4 py-2 text-right font-medium">Documentos</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Apertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {expedientes.map((e) => (
                <tr key={e.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <Link href={`/correspondencia/expedientes/${e.id}`} className="font-mono text-xs font-medium text-cdmb-700 hover:underline">
                      {e.numero}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-stone-700" title={e.asunto}>{e.asunto}</td>
                  <td className="px-4 py-2 text-stone-600">{e.dependencia.nombre}</td>
                  <td className="px-4 py-2 text-xs text-stone-500">{e.serie ? `${e.serie.codigo} — ${e.serie.nombre}` : "Sin clasificar"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{e._count.documentos}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.estado === "ABIERTO" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {e.estado === "ABIERTO" ? <FolderOpen className="h-3 w-3" aria-hidden /> : <FolderCheck className="h-3 w-3" aria-hidden />}
                        {e.estado === "ABIERTO" ? "Abierto" : "Cerrado"}
                      </span>
                      {e.nivelAcceso !== "PUBLICA" && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_NIVEL_ACCESO[e.nivelAcceso]}`}>
                          {ETIQUETA_NIVEL_ACCESO[e.nivelAcceso]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-stone-400">{fecha(e.fechaApertura)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
