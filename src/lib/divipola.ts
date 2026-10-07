export type DatosDivipola = {
  departamentos: readonly { codigo: string; nombre: string }[];
  municipios: readonly (readonly [codigo: string, nombre: string])[];
};

export type OpcionMunicipio = { codigo: string; nombre: string; departamento: string };

export const DEPARTAMENTO_POR_DEFECTO = "Santander";
export const CIUDAD_POR_DEFECTO = "Bucaramanga";

export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function coincide(nombre: string, consulta: string): number {
  const n = sinTildes(nombre);
  const q = sinTildes(consulta);
  if (!q) return 1;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[\s,.-]+/).some((p) => p.startsWith(q))) return 2;
  if (n.includes(q)) return 3;
  return -1;
}

export function departamentoPorNombre(datos: DatosDivipola, nombre: string) {
  const q = sinTildes(nombre);
  if (!q) return undefined;
  return datos.departamentos.find((d) => sinTildes(d.nombre) === q || (q === "bogota" && d.codigo === "11"));
}

export function buscarDepartamentos(datos: DatosDivipola, consulta: string, limite = 8): string[] {
  return datos.departamentos
    .map((d) => ({ nombre: d.nombre, rango: coincide(d.nombre, consulta) }))
    .filter((d) => d.rango >= 0)
    .sort((a, b) => a.rango - b.rango || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, limite)
    .map((d) => d.nombre);
}

export function buscarMunicipios(datos: DatosDivipola, consulta: string, departamento: string, limite = 8): OpcionMunicipio[] {
  const depto = departamentoPorNombre(datos, departamento);
  const nombreDepto = new Map(datos.departamentos.map((d) => [d.codigo, d.nombre]));
  return datos.municipios
    .filter(([codigo]) => !depto || codigo.startsWith(depto.codigo))
    .map(([codigo, nombre]) => ({ codigo, nombre, departamento: nombreDepto.get(codigo.slice(0, 2)) ?? "", rango: coincide(nombre, consulta) }))
    .filter((m) => m.rango >= 0)
    .sort((a, b) => a.rango - b.rango || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, limite)
    .map(({ codigo, nombre, departamento: d }) => ({ codigo, nombre, departamento: d }));
}

export function municipioExacto(datos: DatosDivipola, nombre: string, departamento: string): OpcionMunicipio | undefined {
  const q = sinTildes(nombre);
  if (!q) return undefined;
  return buscarMunicipios(datos, nombre, departamento, 50).find((m) => sinTildes(m.nombre) === q);
}
