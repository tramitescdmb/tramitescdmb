const CLAVE_UTIL = /fecha|estado|status|radic|archivo|documento|url|nombre_?(archivo|documento)|tramite|mensaje|error|actividad/i;
const CLAVE_PERSONAL = /nombre|apellido|correo|email|tel|celular|identific|documento_?id|direccion|razon/i;

/** Resume una respuesta sin datos personales: rutas de campos, fechas, estados y nombres de archivo. */
export function resumirRespuestaVital(v: unknown) {
  const rutas = new Set<string>();
  const valores: Record<string, unknown> = {};
  const recorrer = (x: unknown, ruta: string, prof: number) => {
    if (prof > 5 || x == null) return;
    if (Array.isArray(x)) {
      valores[`${ruta}.length`] = x.length;
      x.slice(0, 5).forEach((y) => recorrer(y, `${ruta}[]`, prof + 1));
      return;
    }
    if (typeof x === "object") {
      for (const [k, y] of Object.entries(x as Record<string, unknown>)) {
        const r = ruta ? `${ruta}.${k}` : k;
        if (y !== null && typeof y === "object") recorrer(y, r, prof + 1);
        else {
          rutas.add(r);
          if (CLAVE_UTIL.test(k) && !(CLAVE_PERSONAL.test(k) && !/archivo|documentos|url/i.test(k))) {
            const t = typeof y === "string" ? (y.startsWith("http") ? y.split("?")[0] : y.slice(0, 120)) : y;
            if (!(r in valores)) valores[r] = t;
          }
        }
      }
    }
  };
  recorrer(v, "", 0);
  return { campos: [...rutas].slice(0, 80), valores };
}


const PATRON_ARCHIVO = /https?:\/\/|VitalFiletraffic|\.(zip|pdf|rtf|docx?|xlsx?|pptx?|jpe?g|png|kml|kmz|shp|dwg)(\?|$)/i;

/** Valores del formulario que parecen una dirección o un archivo (solo esos; ningún otro dato). */
export function encontrarArchivosEnFormulario(v: unknown, ruta = "", prof = 0, salida: Record<string, string> = {}): Record<string, string> {
  if (prof > 5 || v == null) return salida;
  if (typeof v === "string") {
    if (PATRON_ARCHIVO.test(v)) salida[ruta || "(raíz)"] = v.split("?")[0].slice(0, 300);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => encontrarArchivosEnFormulario(x, `${ruta}[${i}]`, prof + 1, salida));
  } else if (typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) encontrarArchivosEnFormulario(x, ruta ? `${ruta}.${k}` : k, prof + 1, salida);
  }
  return salida;
}

