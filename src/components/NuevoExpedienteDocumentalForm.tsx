"use client";

import { useState } from "react";
import { Field, SectionHelp } from "@/components/Field";
import { PlantillaSelector, type PlantillaOpcion } from "@/components/PlantillaSelector";
import { contextoBase } from "@/lib/plantillas-marcadores";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";
import { BuscadorSubserieTRD, type SerieBuscable } from "@/components/BuscadorSubserieTRD";

type Dependencia = { id: string; nombre: string };

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export function NuevoExpedienteDocumentalForm({
  dependencias,
  series,
  plantillas = [],
  usuarioNombre = "",
}: {
  dependencias: Dependencia[];
  series: SerieBuscable[];
  plantillas?: PlantillaOpcion[];
  usuarioNombre?: string;
}) {
  const [dependenciaId, setDependenciaId] = useState(dependencias.length === 1 ? dependencias[0]!.id : "");
  const [serieId, setSerieId] = useState("");
  const [subserieId, setSubserieId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");

  return (
    <form action="/api/correspondencia/expedientes" method="post" className="space-y-4 rounded-xl border border-stone-200 bg-white shadow-soft p-4">
      {plantillas.length > 0 && (
        <PlantillaSelector
          plantillas={plantillas}
          contenidoActual={descripcion}
          asuntoActual={asunto}
          onCargar={setDescripcion}
          onCargarAsunto={setAsunto}
          contexto={{ ...contextoBase(), ASUNTO: asunto, FUNCIONARIO: usuarioNombre, DEPENDENCIA: dependencias.find((d) => d.id === dependenciaId)?.nombre ?? "" }}
        />
      )}
      <Field label="Asunto" required>
        <input name="asunto" required value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} placeholder='Ej. "Contrato de prestación de servicios No. 045-2026"' />
      </Field>
      <Field label="Descripción">
        <textarea name="descripcion" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} />
      </Field>

      <div className="border-t border-stone-100 pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Dependencia y clasificación (TRD)</h3>
        <SectionHelp>Opcional clasificar por serie/subserie — busque por código, nombre o dependencia.</SectionHelp>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dependencia" required>
            <BuscadorDependencia dependencias={dependencias} value={dependenciaId} onChange={setDependenciaId} />
            <input type="hidden" name="dependenciaId" value={dependenciaId} required />
          </Field>
          <Field label="Serie / subserie (TRD)">
            <BuscadorSubserieTRD
              series={series}
              serieId={serieId}
              subserieId={subserieId}
              dependenciaPreferidaId={dependenciaId || null}
              onChange={(s, ss) => { setSerieId(s); setSubserieId(ss); }}
              nameSerie="serieId"
              nameSubserie="subserieId"
            />
          </Field>
        </div>
      </div>

      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cdmb-700">
        Abrir expediente
      </button>
    </form>
  );
}
