import { normalizar } from "@/lib/cargos";

export type SerieCatalogo = {
  id: string;
  nombre: string;
  dependenciaNombre?: string | null;
  subseries: { id: string; codigo: string; nombre: string }[];
};

export type RecomendacionTrd = { serieId: string; subserieId: string; etiqueta: string; motivo: string };

type Regla = { patron: RegExp; serie: RegExp; subserie: RegExp; motivo: string };

const REGLAS: Regla[] = [
  { patron: /convenio.*internacional|internacional.*convenio/, serie: /^convenios$/, subserie: /internacional/, motivo: "convenio de cooperación internacional" },
  { patron: /convenio.*interadministrativ|interadministrativ.*convenio/, serie: /^convenios$/, subserie: /interadministrativ/, motivo: "convenio interadministrativo" },
  { patron: /convenio.*(asociacion|organizacion)|(asociacion|organizacion).*convenio/, serie: /^convenios$/, subserie: /asociacion|organizacion/, motivo: "convenio de asociación u organización" },
  { patron: /convenio/, serie: /^convenios$/, subserie: /cooperacion nacional/, motivo: "convenio" },
  { patron: /interadministrativ/, serie: /^contratos$/, subserie: /interadministrativ/, motivo: "contrato interadministrativo" },
  { patron: /prestacion de (los )?servicios|prestar (sus |los )?servicios|apoyo a la gestion/, serie: /^contratos$/, subserie: /prestacion de servicios/, motivo: "prestación de servicios" },
  { patron: /consultori|interventori|estudios y disenos|diseno de/, serie: /^contratos$/, subserie: /consultoria/, motivo: "consultoría o interventoría" },
  { patron: /\bobras?\b|construccion|adecuacion|mantenimiento de (la |las )?(infraestructura|instalaciones|vias)/, serie: /^contratos$/, subserie: /contratos de obra/, motivo: "obra" },
  { patron: /suministro/, serie: /^contratos$/, subserie: /suministro/, motivo: "suministro" },
  { patron: /arrendamiento|arrendar|alquiler/, serie: /^contratos$/, subserie: /arrendamiento/, motivo: "arrendamiento" },
  { patron: /comodato/, serie: /^contratos$/, subserie: /comodato/, motivo: "comodato" },
  { patron: /fiducia|encargo fiduciario/, serie: /^contratos$/, subserie: /fiducia/, motivo: "fiducia o encargo fiduciario" },
  { patron: /seguros?\b|polizas?\b/, serie: /^contratos$/, subserie: /seguros/, motivo: "seguros" },
  { patron: /credito publico|emprestito/, serie: /^contratos$/, subserie: /credito publico/, motivo: "operación de crédito público" },
  { patron: /servidumbre/, serie: /^contratos$/, subserie: /servidumbre/, motivo: "servidumbre" },
  { patron: /compraventa|adquisicion|adquirir|compra de/, serie: /^contratos$/, subserie: /compraventa/, motivo: "compraventa o adquisición de bienes" },
];

export function seriesDeContratacion(series: SerieCatalogo[]): SerieCatalogo[] {
  return series.filter((s) => /contratacion/.test(normalizar(s.dependenciaNombre ?? "")) && /^(contratos|convenios)$/.test(normalizar(s.nombre).trim()));
}

export function recomendarSubserieContrato(objeto: string, series: SerieCatalogo[]): RecomendacionTrd | null {
  const texto = normalizar(objeto);
  if (!texto.trim()) return null;
  const candidatas = seriesDeContratacion(series);
  for (const regla of REGLAS) {
    if (!regla.patron.test(texto)) continue;
    for (const serie of candidatas) {
      if (!regla.serie.test(normalizar(serie.nombre).trim())) continue;
      const sub = serie.subseries.find((ss) => regla.subserie.test(normalizar(ss.nombre)));
      if (sub) {
        return { serieId: serie.id, subserieId: sub.id, etiqueta: `${sub.codigo} — ${sub.nombre}`, motivo: `el objeto describe un contrato de ${regla.motivo}` };
      }
    }
  }
  return null;
}
