import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleDashed, Gauge, History, ListChecks, Search } from "lucide-react";
import type { EstadoRequisitoMoreq } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import {
  asegurarMatrizMoreq,
  calcularCumplimiento,
  CATEGORIAS_MOREQ,
  ESTADOS_MOREQ,
  ETIQUETA_ESTADO_MOREQ,
  esEstadoMoreq,
} from "@/lib/matriz-moreq";
import { TituloSeccion, TarjetaKpi } from "@/components/sgdea/ui";
import { BotonImprimir } from "@/components/BotonImprimir";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { EditarRequisitoMoreq } from "@/components/sgdea/EditarRequisitoMoreq";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";

const CLASE_ESTADO: Record<EstadoRequisitoMoreq, string> = {
  COMPLETO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PARCIAL: "bg-amber-50 text-amber-800 ring-amber-200",
  PENDIENTE: "bg-red-50 text-red-700 ring-red-200",
};

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function anclaRequisito(numero: string): string {
  return `req-${numero.replace(/\./g, "-")}`;
}

export default async function MatrizMoreqPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const puedeEditar = puedeAdministrarArchivo(permisos);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const estado = esEstadoMoreq(sp.estado) ? sp.estado : null;

  await asegurarMatrizMoreq();
  const requisitos = await db.requisitoMoreq.findMany({
    orderBy: [{ categoria: "asc" }, { orden: "asc" }],
    include: { actualizadoPor: { select: { nombre: true } } },
  });

  const general = calcularCumplimiento(requisitos.map((r) => r.estado));
  const termino = normalizar(q);
  const visibles = requisitos.filter(
    (r) => (!estado || r.estado === estado) && (!termino || normalizar(`${r.numero} ${r.titulo} ${r.nota}`).includes(termino))
  );
  const hayFiltros = Boolean(q || estado);
  const ultimaEdicion = requisitos.reduce<Date | null>((max, r) => (r.actualizadoEn && (!max || r.actualizadoEn > max) ? r.actualizadoEn : max), null);
  const categorias = CATEGORIAS_MOREQ.map((c) => {
    const todas = requisitos.filter((r) => r.categoria === c.n);
    return { ...c, cumplimiento: calcularCumplimiento(todas.map((r) => r.estado)), filas: visibles.filter((r) => r.categoria === c.n) };
  });

  return (
    <div className="space-y-4">
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-stone-900">Matriz de cumplimiento MoReq — CDMB</h1>
        <p className="text-xs text-stone-500">
          Corte: {formatearFechaHora(new Date())} · cumplimiento general {general.porcentaje} % · {general.completos} completos, {general.parciales}{" "}
          parciales, {general.pendientes} pendientes{hayFiltros ? " · con filtros aplicados" : ""}
        </p>
      </div>

      <div className="print:hidden">
        <TituloSeccion
          icon={ListChecks}
          contador={general.total}
          accion={
            <div className="flex flex-wrap items-center gap-2">
              {puedeEditar && (
                <Link
                  prefetch={false}
                  href="/correspondencia/bitacora?entidad=RequisitoMoreq"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  <History className="h-3.5 w-3.5" aria-hidden />
                  Historial de cambios
                </Link>
              )}
              <BotonImprimir variante="secundario" />
              <DescargarCsvBoton href="/api/correspondencia/matriz-moreq/exportar" label="CSV" />
            </div>
          }
        >
          Matriz de cumplimiento MoReq
        </TituloSeccion>
        <p className="mt-2 max-w-3xl text-sm text-stone-600">
          Adaptación institucional del Modelo de requisitos MOREQ (Función Pública, versión 5, diciembre de 2025) aplicada al SGDEA de la CDMB,
          junto con el Acuerdo 001 de 2024 del AGN.
          {ultimaEdicion && <> Última actualización: {formatearFecha(ultimaEdicion)}.</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2 text-stone-400">
            <Gauge className="h-4 w-4 text-cdmb-600" aria-hidden />
            <span className="text-xs uppercase tracking-wide">Cumplimiento general</span>
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{general.porcentaje} %</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${general.porcentaje}%` }} />
          </div>
        </div>
        <TarjetaKpi icon={CheckCircle2} label="Completos" value={general.completos} tono="verde" />
        <TarjetaKpi icon={CircleDashed} label="Parciales" value={general.parciales} tono="ambar" />
        <TarjetaKpi icon={CircleAlert} label="Pendientes" value={general.pendientes} tono="rojo" />
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 shadow-soft print:hidden">
        <span className="flex min-w-[220px] flex-1 items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1.5 focus-within:border-vivo-500 focus-within:ring-1 focus-within:ring-vivo-500">
          <Search className="h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
          <input type="text" name="q" defaultValue={q} placeholder="Número, requisito o nota" className="w-full text-sm outline-none" />
        </span>
        <select name="estado" defaultValue={estado ?? ""} className="flex-none rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {ESTADOS_MOREQ.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_MOREQ[e]}
            </option>
          ))}
        </select>
        <button type="submit" className="flex-none rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600">
          Filtrar
        </button>
        {hayFiltros && (
          <Link prefetch={false} href="/correspondencia/matriz-moreq" className="flex-none rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
            Limpiar
          </Link>
        )}
        {hayFiltros && (
          <span className="text-xs text-stone-500">
            {visibles.length} de {general.total} requisitos
          </span>
        )}
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr] lg:items-start">
        <nav aria-label="Categorías de la matriz" className="space-y-1 lg:sticky lg:top-16 print:hidden">
          {categorias.map((c) => (
            <a key={c.n} href={`#categoria-${c.n}`} className="block rounded-lg px-2.5 py-2 text-sm text-stone-600 hover:bg-white hover:text-stone-900">
              <span className="block leading-snug">
                {c.n} · {c.titulo}
              </span>
              <span className="mt-1 flex items-center gap-2">
                <span className="w-9 flex-none text-[11px] tabular-nums text-stone-500">{c.cumplimiento.porcentaje} %</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200" aria-hidden>
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${c.cumplimiento.porcentaje}%` }} />
                </span>
              </span>
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-8">
          {visibles.length === 0 && (
            <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-400">
              No hay requisitos que coincidan con el filtro.
            </p>
          )}
          {categorias
            .filter((c) => c.filas.length > 0)
            .map((c) => (
              <section key={c.n} id={`categoria-${c.n}`} className="scroll-mt-16">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-cdmb-600 pb-1.5">
                  <h2 className="text-base font-semibold text-stone-900">
                    {c.n} · {c.titulo}
                  </h2>
                  <span className="text-xs tabular-nums text-stone-500">
                    {c.cumplimiento.porcentaje} % · {c.cumplimiento.completos} completos · {c.cumplimiento.parciales} parciales · {c.cumplimiento.pendientes} pendientes
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-stone-500">{c.descripcion}</p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-soft print:overflow-visible">
                  <table className="w-full text-sm">
                    <thead className="border-b border-stone-100 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">No.</th>
                        <th className="px-3 py-2 font-medium">Requisito</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Nota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {c.filas.map((r) => (
                        <tr key={r.id} id={anclaRequisito(r.numero)} className="scroll-mt-16 align-top target:bg-amber-50/70">
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-stone-500">{r.numero}</td>
                          <td className="min-w-[200px] px-3 py-2.5 font-medium text-stone-800">{r.titulo}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${CLASE_ESTADO[r.estado]}`}>
                              {ETIQUETA_ESTADO_MOREQ[r.estado]}
                            </span>
                          </td>
                          <td className="min-w-[260px] px-3 py-2.5 text-xs leading-relaxed text-stone-600">
                            {r.nota}
                            {r.actualizadoEn && (
                              <span className="mt-1 block text-[10px] text-stone-400">
                                Editado el {formatearFechaHora(r.actualizadoEn)}
                                {r.actualizadoPor && <> por {r.actualizadoPor.nombre}</>}
                              </span>
                            )}
                            {puedeEditar && (
                              <EditarRequisitoMoreq
                                key={`${r.id}-${r.actualizadoEn?.getTime() ?? 0}`}
                                id={r.id}
                                numero={r.numero}
                                titulo={r.titulo}
                                estado={r.estado}
                                nota={r.nota}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

          <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600 shadow-soft">
            <summary className="cursor-pointer font-medium text-stone-800">Cómo leer el porcentaje</summary>
            <div className="mt-3 space-y-2">
              <p>
                El MOREQ de la Función Pública se usa como referencia técnica, adaptada al alcance de la CDMB. La norma vigente para toda entidad
                pública es el Acuerdo 001 de 2024 del AGN (Acuerdo Único de la Función Archivística), de donde sale, por ejemplo, la definición de
                expediente electrónico del artículo 4.3.2.
              </p>
              <p>
                El modelo está pensado para evaluar un producto comercial de gestión documental: exige, entre otros, digitalización masiva con OCR,
                integración de correo electrónico y firma digital con certificado. El porcentaje suma los requisitos completos y la mitad de los
                parciales, sobre el total.
              </p>
              <p>Los pendientes corresponden a uno de tres casos:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Fuera del alcance actual: digitalización masiva con OCR, integración de correo, almacenamiento NAS, DAS o SAN.</li>
                <li>Decisión consciente: firma electrónica con hash en lugar de firma digital con certificado; contraseñas con bcrypt en lugar de MD5 o SHA.</li>
                <li>Brechas priorizables: PDF/A para preservación, avisos por correo o SMS y expedientes híbridos físico-electrónicos.</li>
              </ul>
              <p className="text-xs text-stone-400">
                Fuentes: Modelo de requisitos MOREQ, DAFP, versión 5 (2025-12-11) · Ley 594 de 2000 · Ley 1437 de 2011 (CPACA) · Ley 1712 de 2014 ·
                Ley 527 de 1999 · Decreto 1080 de 2015 · Acuerdo 001 de 2024 AGN.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
