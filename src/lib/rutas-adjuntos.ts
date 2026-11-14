import { db } from "@/lib/db";
import { rutaDeExpediente } from "@/lib/storage";

/**
 * Los adjuntos de un radicado nuevo (PQRSD pública, ventanilla, oficio de salida, memorando,
 * respuesta) se suben todos a una carpeta recién creada por el navegador. Comprueba que todas las
 * rutas estén en esa misma carpeta y que la carpeta no sea la de un expediente existente, para que
 * no se pueda adjuntar un archivo ajeno escribiendo su ruta.
 */
export async function rutasDeCarpetaNueva(documentos: { path: string }[]): Promise<boolean> {
  if (documentos.length === 0) return true;
  const carpeta = documentos[0]!.path.split("/")[1] ?? "";
  if (!documentos.every((d) => rutaDeExpediente(d.path, carpeta))) return false;
  const [tramite, contrato, documental] = await Promise.all([
    db.expediente.count({ where: { id: carpeta } }),
    db.expedienteContractual.count({ where: { id: carpeta } }),
    db.expedienteDocumental.count({ where: { id: carpeta } }),
  ]);
  return tramite + contrato + documental === 0;
}
