// Extrae el texto de los PDF que ya existían antes de esta función (los subidos después ya lo
// hacen solos al radicar/agregar). Se puede volver a correr en cualquier momento: solo toca las
// filas con contenidoTexto todavía en null, así que es seguro repetirlo si algo quedó a medias.
import { db } from "../src/lib/db.ts";
import { descargarDocumento } from "../src/lib/storage.ts";
import { extraerTextoPdf } from "../src/lib/texto-pdf.ts";

const TAMANO_LOTE = 25;

async function procesarTabla(nombre, contar, listar, actualizar) {
  const total = await contar();
  console.log(`${nombre}: ${total} documento(s) PDF sin texto extraído.`);
  let procesados = 0;
  let fallidos = 0;
  for (;;) {
    const lote = await listar(TAMANO_LOTE);
    if (lote.length === 0) break;
    for (const doc of lote) {
      let texto = null;
      try {
        const bytes = await descargarDocumento(doc.storagePath);
        texto = await extraerTextoPdf(bytes);
      } catch (e) {
        fallidos++;
        console.error(`  falló ${doc.id} (${doc.storagePath}):`, e instanceof Error ? e.message : e);
      }
      // Se marca igual con éxito vacío que con error: en ambos casos no queda texto buscable,
      // y así la fila sale del lote de "pendientes" y no se reintenta en cada corrida.
      await actualizar(doc.id, texto);
      procesados++;
    }
    console.log(`${nombre}: ${procesados}/${total} procesados (${fallidos} fallidos)…`);
    await db.$disconnect();
  }
}

await procesarTabla(
  "ComunicacionDocumento",
  () => db.comunicacionDocumento.count({ where: { mimeType: "application/pdf", contenidoTexto: null } }),
  (take) => db.comunicacionDocumento.findMany({ where: { mimeType: "application/pdf", contenidoTexto: null }, select: { id: true, storagePath: true }, take }),
  (id, texto) => db.comunicacionDocumento.update({ where: { id }, data: { contenidoTexto: texto ?? "" } }),
);

await procesarTabla(
  "DocumentoArchivo",
  () => db.documentoArchivo.count({ where: { mimeType: "application/pdf", contenidoTexto: null } }),
  (take) => db.documentoArchivo.findMany({ where: { mimeType: "application/pdf", contenidoTexto: null }, select: { id: true, storagePath: true }, take }),
  (id, texto) => db.documentoArchivo.update({ where: { id }, data: { contenidoTexto: texto ?? "" } }),
);

console.log("Listo.");
await db.$disconnect();
