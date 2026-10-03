import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { SectionHelp } from "@/components/Field";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { SelectorClasificacionTrd } from "@/components/admin/SelectorClasificacionTrd";
import { SelectorSubserieTrdCascada } from "@/components/admin/SelectorSubserieTrdCascada";
import { ProveedorCatalogoTrd } from "@/components/trd/CatalogoTrd";
import { ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, ORDEN_MODALIDADES } from "@/lib/contratacion-etiquetas";
import {
  catalogoSeriesBuscablesCacheado,
  tiposDocumentalesPorSubserie,
  tramitesParaClasificar,
  requisitosContratacionParaClasificar,
  subserieContratacionActual,
  subseriesPorModalidad,
} from "@/lib/trd-clasificacion";

export default async function AdminTrdPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Clasificación TRD" volverHref="/" volverLabel="Ir al inicio" />;

  const [series, tiposPorSubserie, tramites, requisitos, subserieContratacionId, porModalidad] = await Promise.all([
    catalogoSeriesBuscablesCacheado(),
    tiposDocumentalesPorSubserie(),
    tramitesParaClasificar(),
    requisitosContratacionParaClasificar(),
    subserieContratacionActual(),
    subseriesPorModalidad(),
  ]);

  const requisitosPorEtapa = new Map<string, typeof requisitos>();
  for (const r of requisitos) {
    const lista = requisitosPorEtapa.get(r.etapa) ?? [];
    lista.push(r);
    requisitosPorEtapa.set(r.etapa, lista);
  }
  const tiposDeSubserieContratacion = subserieContratacionId ? tiposPorSubserie.get(subserieContratacionId) ?? [] : [];

  return (
    <ProveedorCatalogoTrd series={series}>
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Clasificación TRD — Trámites y GECON</h1>
        <p className="text-sm text-stone-500">
          Asigna la serie/subserie y el tipo documental que ya existen en la TRD del SGDEA a los expedientes de Trámites
          Ambientales 2.0 y de Contratación (GECON). Sin esta clasificación no se puede calcular la retención ni el
          reporte de próximos a disposición final. Cada cambio se guarda de inmediato.
        </p>
      </div>

      <SectionHelp>
        Un expediente (de trámite o de contrato) es UN solo legajo archivístico: se clasifica una vez por tipo de
        trámite o, en GECON, por contrato según su modalidad de contratación, no por
        cada documento individual. Cada documento exigido dentro de ese expediente sí puede tener su propio tipo
        documental.
      </SectionHelp>

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">GECON — subserie por modalidad de contratación</h2>
          <p className="text-xs text-stone-500">
            Cada expediente contractual se clasifica automáticamente con la subserie de su modalidad, al crearlo y al cambiarle la
            modalidad. Se guarda de inmediato; un contrato puntual se puede reclasificar desde su expediente.
          </p>
        </div>
        <div className="divide-y divide-stone-100">
          {ORDEN_MODALIDADES.map((m) => (
            <div key={m} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[260px_1fr] md:items-start">
              <p className="text-sm font-medium text-stone-800">{ETIQUETA_MODALIDAD[m]}</p>
              <SelectorSubserieTrdCascada tipo="modalidad" id={m} valorInicial={porModalidad[m] ?? null} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <h2 className="text-sm font-semibold text-stone-900">GECON — subserie de respaldo</h2>
        <p className="mb-3 text-xs text-stone-500">
          Se usa solo para los contratos cuya modalidad no tiene subserie asignada arriba.
        </p>
        <SelectorSubserieTrdCascada tipo="configuracion" valorInicial={subserieContratacionId} />
      </section>

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">GECON — tipo documental por requisito</h2>
          <p className="text-xs text-stone-500">{requisitos.length} requisitos del catálogo, agrupados por etapa.</p>
        </div>
        <div className="divide-y divide-stone-100">
          {(["PRECONTRACTUAL", "CONTRACTUAL", "POSTCONTRACTUAL"] as const).map((etapa) => {
            const lista = requisitosPorEtapa.get(etapa) ?? [];
            if (lista.length === 0) return null;
            return (
              <details key={etapa} className="group">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                  {ETIQUETA_ETAPA[etapa]}
                  <span className="text-xs font-normal text-stone-400">{lista.length}</span>
                </summary>
                <ul className="divide-y divide-stone-100 bg-stone-50/40 px-4">
                  {lista.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-sm text-stone-700">{r.nombre}</span>
                      <SelectorClasificacionTrd
                        tipo="requisitoContratacion"
                        id={r.id}
                        valorInicial={r.tipoDocumentalId}
                        opciones={tiposDeSubserieContratacion.map((t) => ({ id: t.id, etiqueta: t.nombre }))}
                        deshabilitado={!subserieContratacionId}
                        placeholder={subserieContratacionId ? "— Sin clasificar —" : "Clasifique primero la subserie de GECON"}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Trámites 2.0 — subserie por tipo de trámite</h2>
          <p className="text-xs text-stone-500">{tramites.length} tipos de trámite activos.</p>
        </div>
        <ul className="divide-y divide-stone-100">
          {tramites.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <p className="mb-1.5 text-sm text-stone-700">
                {t.codigo} — {t.nombre}
              </p>
              <SelectorSubserieTrdCascada tipo="tramiteTipo" id={t.id} valorInicial={t.subserieId} />
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Trámites 2.0 — tipo documental por documento exigido al radicar</h2>
          <p className="text-xs text-stone-500">
            {tramites.reduce((s, t) => s + t.documentosRequeridos.length, 0)} documentos, agrupados por trámite. Solo se puede
            elegir un tipo documental de la subserie ya asignada a ese trámite arriba.
          </p>
        </div>
        <div className="divide-y divide-stone-100">
          {tramites
            .filter((t) => t.documentosRequeridos.length > 0)
            .map((t) => {
              const tiposDisponibles = t.subserieId ? tiposPorSubserie.get(t.subserieId) ?? [] : [];
              return (
                <details key={t.id} className="group">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                    {t.codigo} — {t.nombre}
                    <span className="text-xs font-normal text-stone-400">{t.documentosRequeridos.length}</span>
                  </summary>
                  <ul className="divide-y divide-stone-100 bg-stone-50/40 px-4">
                    {t.documentosRequeridos.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="text-sm text-stone-700">{d.nombre}</span>
                        <SelectorClasificacionTrd
                          tipo="documentoRequerido"
                          id={d.id}
                          valorInicial={d.tipoDocumentalId}
                          opciones={tiposDisponibles.map((ti) => ({ id: ti.id, etiqueta: ti.nombre }))}
                          deshabilitado={!t.subserieId}
                          placeholder={t.subserieId ? "— Sin clasificar —" : "Clasifique primero la subserie de este trámite"}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
        </div>
      </section>
    </div>
    </ProveedorCatalogoTrd>
  );
}
