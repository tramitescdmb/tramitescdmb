import { PrismaClient, type ModalidadSeleccion, type EtapaContratacion, type Prisma } from "@prisma/client";
import requisitosJson from "../data/contratacion/requisitos.json";

const db = new PrismaClient();

type RequisitoJson = {
  modalidadSeleccion: ModalidadSeleccion | null;
  etapa: EtapaContratacion;
  orden: number;
  nombre: string;
  codigoFormato: string | null;
  obligatorio: boolean;
  gestionadoEnSecop?: boolean;
  notaOrigenExterno?: string;
  fuente: string;
};

const requisitos = requisitosJson as RequisitoJson[];

/**
 * Siembra el catálogo de documentos exigidos por el Manual de Contratación
 * (A-BS-MA01) y sus 33 procedimientos — ver data/contratacion/requisitos.json,
 * extraído de las tablas ACTIVIDAD/RESPONSABLE/DOCUMENTOS de cada procedimiento
 * real cruzadas con los 76 formatos oficiales (mismo método usado para los 30
 * procedimientos de Trámites ambientales 2.0). Reemplaza el catálogo completo
 * en cada corrida (no hay expedientes reales seed-dependientes; los
 * DocumentoContrato ya subidos conservan su fila aunque cambie el catálogo,
 * porque DocumentoContrato.requisitoId usa onDelete: SetNull).
 */
async function main() {
  await db.requisitoDocumentoContratacion.deleteMany({});
  await db.requisitoDocumentoContratacion.createMany({
    data: requisitos satisfies Prisma.RequisitoDocumentoContratacionCreateManyInput[],
  });
  const total = await db.requisitoDocumentoContratacion.count();
  console.log(`Catálogo de Contratación sembrado: ${total} requisitos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
