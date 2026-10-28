import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarFormatosVisita } from "@/lib/permisos";
import { BandaTablero } from "@/components/tablero";
import { formatearFechaHora } from "@/lib/fecha";
import { NuevoFormatoVisita } from "@/components/formatos/NuevoFormatoVisita";
import { ConsecutivoConceptos } from "@/components/formatos/ConsecutivoConceptos";
import { coberturaFormatos } from "@/lib/formatos-visita-db";
import { codigoProcedimiento } from "@/lib/temas-visita";
import { FORMATOS_BASE } from "@/lib/formatos-visita-base";
import { siguienteConcepto } from "@/lib/concepto-tecnico";
import { partesColombia } from "@/lib/planeador";

export default async function FormatosVisitaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarFormatosVisita(permisos)) notFound();

  const anio = Number(partesColombia(new Date()).fecha.slice(0, 4));
  const [formatos, tipos, cobertura, siguiente] = await Promise.all([
    db.formatoVisita.findMany({
      orderBy: [{ activo: "desc" }, { porDefecto: "asc" }, { nombre: "asc" }],
      include: {
        versiones: { select: { numero: true, estado: true, publicadaEn: true, updatedAt: true, _count: { select: { visitas: true } } }, orderBy: { numero: "desc" } },
      },
    }),
    db.tramiteTipo.findMany({ select: { codigo: true, nombre: true } }),
    coberturaFormatos(),
    siguienteConcepto(anio),
  ]);
  const nombreTipo = new Map(tipos.map((t) => [t.codigo, t.nombre]));
  const faltanBase = FORMATOS_BASE.filter((b) => !formatos.some((f) => f.codigo === b.codigo)).map((b) => b.nombre);
  const propios = cobertura.filter((c) => c.formato?.propio).length;
  const sinFormato = cobertura.filter((c) => !c.formato).length;

  return (
    <div className="space-y-4">
      <BandaTablero>
        <h2 className="flex items-center gap-2.5 text-xl font-semibold text-stone-900">
          <span className="flex h-9 w-9 flex-none items-center justify-center text-cdmb-700">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
          </span>
          Formatos de visita técnica
        </h2>
        <p className="text-sm text-stone-500">Cada trámite usa la versión publicada de su formato. Las visitas ya registradas conservan la versión con la que se diligenciaron.</p>
      </BandaTablero>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <NuevoFormatoVisita
          formatos={formatos.map((f) => ({ id: f.id, nombre: f.nombre, codigo: f.codigo }))}
          faltanBase={faltanBase}
          tramitesLibres={cobertura.filter((c) => !c.formato?.propio).map((c) => ({ codigo: codigoProcedimiento(c.codigo), nombre: c.nombre }))}
        />
        <ConsecutivoConceptos anio={anio} siguiente={siguiente} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              <th className="px-3 py-2 font-medium">Formato</th>
              <th className="px-3 py-2 font-medium">Trámites</th>
              <th className="px-3 py-2 font-medium">Versión vigente</th>
              <th className="px-3 py-2 font-medium">Pendiente</th>
              <th className="px-3 py-2 text-right font-medium">Visitas</th>
            </tr>
          </thead>
          <tbody>
            {formatos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-stone-400">
                  Aún no hay formatos.
                </td>
              </tr>
            )}
            {formatos.map((f) => {
              const publicada = f.versiones.find((v) => v.estado === "PUBLICADA");
              const borrador = f.versiones.find((v) => v.estado === "BORRADOR");
              const visitas = f.versiones.reduce((a, v) => a + v._count.visitas, 0);
              return (
                <tr key={f.id} className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/60 ${f.activo ? "" : "opacity-60"}`}>
                  <td className="px-3 py-2">
                    <Link href={`/planeador/formatos/${f.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {f.nombre}
                    </Link>
                    <span className="block font-mono text-[11px] text-stone-400">
                      {f.codigo}
                      {!f.activo && " · inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {f.porDefecto && <span className="mb-0.5 block font-medium text-cdmb-700">Genérico: los demás trámites con visita</span>}
                    {f.tramites.length === 0 && !f.porDefecto ? <span className="text-amber-700">Sin trámite asociado</span> : f.tramites.map((t) => <span key={t} className="block">{nombreTipo.get(t) ?? t}</span>)}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">{publicada ? `v${publicada.numero} · ${publicada.publicadaEn ? formatearFechaHora(publicada.publicadaEn) : ""}` : <span className="text-amber-700">Sin publicar</span>}</td>
                  <td className="px-3 py-2 text-xs">{borrador ? <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-amber-800">Borrador v{borrador.numero}</span> : <span className="text-stone-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-stone-600">{visitas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="group rounded-2xl border border-stone-200 bg-white shadow-soft" open>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
          <span className="font-semibold text-stone-900">Trámites con visita técnica</span>
          <Link href="/planeador/actividades" className="text-xs font-medium text-cdmb-700 hover:underline">
            Asignar formato por paso
          </Link>
          <span className="text-xs text-stone-500">
            {cobertura.length} procedimientos · {propios} con formato propio · {cobertura.length - propios - sinFormato} con el genérico
            {sinFormato > 0 && <span className="text-amber-700"> · {sinFormato} sin formato</span>}
          </span>
        </summary>
        <div className="overflow-x-auto border-t border-stone-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-50 text-left text-stone-500">
                <th className="px-3 py-1.5 font-medium">Procedimiento</th>
                <th className="px-3 py-1.5 font-medium">Pasos de visita</th>
                <th className="px-3 py-1.5 font-medium">Formato que usa</th>
              </tr>
            </thead>
            <tbody>
              {cobertura.map((c) => (
                <tr key={c.codigo} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-[10px] text-stone-400">{c.codigo}</span>
                    <span className="block text-stone-800">{c.nombre}</span>
                  </td>
                  <td className="px-3 py-1.5 text-stone-500">{c.pasosVisita.join(" · ")}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {c.formato ? (
                      <Link href={`/planeador/formatos/${c.formato.id}`} className={c.formato.propio ? "font-medium text-cdmb-700 hover:underline" : "text-stone-600 hover:underline"}>
                        {c.formato.nombre}
                        {!c.formato.publicado && <span className="text-amber-700"> (sin publicar)</span>}
                      </Link>
                    ) : (
                      <span className="text-amber-700">Sin formato: hoja con temas</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
