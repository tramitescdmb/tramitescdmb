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
