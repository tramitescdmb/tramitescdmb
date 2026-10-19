import { FolderTree } from "lucide-react";
import { SectionHelp } from "@/components/Field";
import { SelectorClasificacionTrd } from "@/components/admin/SelectorClasificacionTrd";
import { SelectorSubserieTrdCascada } from "@/components/admin/SelectorSubserieTrdCascada";
import { ProveedorCatalogoTrd } from "@/components/trd/CatalogoTrd";
import { CabeceraTablero } from "@/components/tablero";
import { ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, ORDEN_MODALIDADES } from "@/lib/contratacion-etiquetas";
import {
  catalogoSeriesBuscablesCacheado,
  tiposDocumentalesPorSubserie,
  tramitesParaClasificar,
  requisitosContratacionParaClasificar,
  subserieContratacionActual,
  subseriesPorModalidad,
} from "@/lib/trd-clasificacion";

const SECCION = "overflow-hidden rounded-md border border-stone-200 bg-white";

export async function ClasificacionTrdTramites() {
  const [series, tiposPorSubserie, tramites] = await Promise.all([
    catalogoSeriesBuscablesCacheado(),
    tiposDocumentalesPorSubserie(),
    tramitesParaClasificar(),
  ]);

  return (
    <ProveedorCatalogoTrd series={series}>
      <div className="space-y-4">
        <CabeceraTablero
          icon={FolderTree}
          titulo="Clasificación TRD"
          descripcion="Serie, subserie y tipo documental de la TRD del SGDEA para los expedientes de trámite. Sin esta clasificación no se calcula la retención. Cada cambio se guarda de inmediato."
        />

        <SectionHelp>
          Un expediente de trámite es un solo legajo archivístico: se clasifica una vez por tipo de trámite, no por cada documento.
          Cada documento exigido al radicar sí puede tener su propio tipo documental.
        </SectionHelp>

        <section className={SECCION}>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">Subserie por tipo de trámite</h2>
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

        <section className={SECCION}>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">Tipo documental por documento exigido al radicar</h2>
            <p className="text-xs text-stone-500">
              {tramites.reduce((s, t) => s + t.documentosRequeridos.length, 0)} documentos, agrupados por trámite. Solo se puede elegir
              un tipo documental de la subserie ya asignada a ese trámite.
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

export async function ClasificacionTrdGecon() {
  const [series, tiposPorSubserie, requisitos, subserieContratacionId, porModalidad] = await Promise.all([
    catalogoSeriesBuscablesCacheado(),
    tiposDocumentalesPorSubserie(),
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
      <div className="space-y-4">
        <CabeceraTablero
          icon={FolderTree}
          titulo="Clasificación TRD"
          descripcion="Serie, subserie y tipo documental de la TRD del SGDEA para los expedientes contractuales. Sin esta clasificación no se calcula la retención. Cada cambio se guarda de inmediato."
        />

        <SectionHelp>
          Un expediente contractual es un solo legajo archivístico: se clasifica por contrato según su modalidad de contratación, no
          por cada documento. Cada requisito dentro del expediente sí puede tener su propio tipo documental.
        </SectionHelp>

        <section className={SECCION}>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">Subserie por modalidad de contratación</h2>
            <p className="text-xs text-stone-500">
              Cada expediente contractual se clasifica automáticamente con la subserie de su modalidad, al crearlo y al cambiarle la
              modalidad. Un contrato puntual se puede reclasificar desde su expediente.
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

        <section className={`${SECCION} p-4`}>
          <h2 className="text-sm font-semibold text-stone-900">Subserie de respaldo</h2>
          <p className="mb-3 text-xs text-stone-500">Se usa solo para los contratos cuya modalidad no tiene subserie asignada.</p>
          <SelectorSubserieTrdCascada tipo="configuracion" valorInicial={subserieContratacionId} />
        </section>

        <section className={SECCION}>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">Tipo documental por requisito</h2>
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
                          placeholder={subserieContratacionId ? "— Sin clasificar —" : "Clasifique primero la subserie de respaldo"}
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
