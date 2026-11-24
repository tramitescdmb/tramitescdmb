/** Validación (pura) de taxonomía y personas de Negocios Verdes. */
import { esMunicipioNV, slugNV } from "@/lib/negocios-verdes";
import { NATURALEZAS } from "@/lib/negocios-verdes-ficha";
import { problemaCorreo } from "@/lib/negocios-verdes-verificacion";

export type NivelTaxonomia = "categoria" | "subcategoria" | "actividad";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const txt = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function validarTaxon(e: Record<string, unknown>) {
  const errores: string[] = [];
  const nivel = e.nivel === "categoria" || e.nivel === "subcategoria" || e.nivel === "actividad" ? (e.nivel as NivelTaxonomia) : null;
  if (!nivel) errores.push("Nivel no válido.");
  const nombre = txt(e.nombre, 150);
  if (!nombre) errores.push("Escriba el nombre.");
  const slug = slugNV(txt(e.slug) ?? nombre ?? "");
  const padreId = typeof e.padreId === "string" && UUID.test(e.padreId) ? e.padreId : null;
  if (nivel && nivel !== "categoria" && !padreId) errores.push(nivel === "subcategoria" ? "Elija la categoría." : "Elija la subcategoría.");
  const orden = Number(e.orden ?? 0);
  return {
    errores,
    datos:
      errores.length > 0 || !nivel || !nombre
        ? null
        : {
            nivel,
            nombre,
            slug,
            padreId,
            icono: txt(e.icono, 16),
            descripcion: txt(e.descripcion, 2000),
            categoriaNacional: txt(e.categoriaNacional, 200),
            orden: Number.isFinite(orden) ? Math.max(0, Math.min(999, Math.trunc(orden))) : 0,
            activo: e.activo !== false,
          },
  };
}

export const TIPOS_PERSONA = { RESPONSABLE_CDMB: "Responsable CDMB", DELEGADO: "Delegado", REPRESENTANTE: "Representante" } as const;
export type TipoPersonaNV = keyof typeof TIPOS_PERSONA;
export const esTipoPersona = (v: unknown): v is TipoPersonaNV => typeof v === "string" && v in TIPOS_PERSONA;

export function validarPersona(e: Record<string, unknown>) {
  const errores: string[] = [];
  if (!esTipoPersona(e.tipo)) errores.push("Tipo de persona no válido.");
  const nombres = txt(e.nombres, 120);
  if (!nombres) errores.push("Escriba los nombres.");
  const correo = txt(e.correo, 200);
  const malCorreo = problemaCorreo(correo);
  if (malCorreo) errores.push(malCorreo);
  const municipio = txt(e.municipio);
  const naturaleza = txt(e.naturalezaJuridica);
  if (naturaleza && !(NATURALEZAS as readonly string[]).includes(naturaleza)) errores.push("Naturaleza jurídica no válida.");
  return {
    errores,
    datos:
      errores.length > 0 || !nombres || !esTipoPersona(e.tipo)
        ? null
        : {
            tipo: e.tipo,
            nombres,
            apellidos: txt(e.apellidos, 120),
            tipoDocumento: txt(e.tipoDocumento, 20),
            documento: txt(e.documento, 30),
            telefono: txt(e.telefono, 40),
            correo,
            cargo: txt(e.cargo, 120),
            direccion: txt(e.direccion),
            municipio: municipio && esMunicipioNV(municipio) ? municipio : municipio,
            naturalezaJuridica: naturaleza,
            activo: e.activo !== false,
          },
  };
}
