import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Base de datos en memoria: un contrato con documentos y una tabla de adjuntos de correspondencia.
type Fila = { id: string; storagePath: string; etapa?: string; esRespuesta?: boolean; comunicacionId?: string };
const tablas: Record<string, Fila[]> = {};
const contrato = { numero: "CDMB-CTO-2026-000003", numeroContrato: "1520-2026" as string | null, tipoContrato: "PRESTACION_SERVICIOS", fechaInicio: new Date("2026-02-01T00:00:00Z"), createdAt: new Date("2026-01-20T15:00:00Z") };
const comunicaciones: Record<string, { anio: number; tipo: string; radicado: string }> = {};

function tabla(nombre: string) {
  return {
    count: async ({ where }: { where: { storagePath: string } }) => (tablas[nombre] ?? []).filter((f) => f.storagePath === where.storagePath).length,
    updateMany: async ({ where, data }: { where: { storagePath: string }; data: { storagePath: string } }) => {
      let count = 0;
      for (const f of tablas[nombre] ?? []) {
        if (f.storagePath !== where.storagePath) continue;
        f.storagePath = data.storagePath;
        count++;
      }
      return { count };
    },
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    expedienteDocumento: tabla("expedienteDocumento"),
    visitaTecnicaFoto: tabla("visitaTecnicaFoto"),
    documentoContrato: tabla("documentoContrato"),
    comunicacionDocumento: tabla("comunicacionDocumento"),
    documentoArchivo: tabla("documentoArchivo"),
    solicitudVitalDocumento: tabla("solicitudVitalDocumento"),
    expedienteContractual: {
      findUnique: async () => ({ ...contrato, documentos: (tablas.documentoContrato ?? []).map((d) => ({ storagePath: d.storagePath, etapa: d.etapa })) }),
    },
    comunicacion: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = comunicaciones[where.id];
        if (!c) return null;
        const documentos = (tablas.comunicacionDocumento ?? []).filter((d) => d.comunicacionId === where.id).map((d) => ({ storagePath: d.storagePath, esRespuesta: !!d.esRespuesta }));
        return { ...c, documentos };
      },
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import { organizarArchivos } from "./organizar-archivos";

let raiz: string;
const fisico = (r: string) => path.join(raiz, "documentos", r);
async function crear(r: string, contenido = "pdf") {
  await fs.mkdir(path.dirname(fisico(r)), { recursive: true });
  await fs.writeFile(fisico(r), contenido);
}
const existe = (r: string) => fs.stat(fisico(r)).then(() => true, () => false);

beforeEach(async () => {
  raiz = await fs.mkdtemp(path.join(os.tmpdir(), "almacen-"));
  vi.stubEnv("ALMACEN_LOCAL_DIR", raiz);
  for (const k of Object.keys(tablas)) delete tablas[k];
  for (const k of Object.keys(comunicaciones)) delete comunicaciones[k];
  contrato.numeroContrato = "1520-2026";
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(raiz, { recursive: true, force: true });
});

describe("organizarArchivos", () => {
  it("mueve lo recién subido a Gecon/<vigencia>/<tipo>/<contrato>/<etapa>, sin cambiar el contenido, y borra la carpeta de llegada vacía", async () => {
    await crear("_subidas/u1/1731600000000-Informe_octubre.pdf", "contenido-firmado");
    tablas.documentoContrato = [{ id: "d1", storagePath: "_subidas/u1/1731600000000-Informe_octubre.pdf", etapa: "CONTRACTUAL" }];

    const r = await organizarArchivos({ tipo: "contrato", id: "c1" });

    const destino = "Gecon/2026/prestacion-de-servicios/contrato-1520-2026/contractual/Informe_octubre.pdf";
    expect(r).toEqual([{ origen: "_subidas/u1/1731600000000-Informe_octubre.pdf", destino, estado: "movido" }]);
    expect(tablas.documentoContrato[0]!.storagePath).toBe(destino);
    expect(await fs.readFile(fisico(destino), "utf8")).toBe("contenido-firmado");
    expect(await existe("_subidas/u1")).toBe(false);
    expect(await existe("_subidas")).toBe(false);
  });

  it("no pisa un archivo con el mismo nombre: usa _2", async () => {
    const carpeta = "Gecon/2026/prestacion-de-servicios/contrato-1520-2026/precontractual";
    await crear(`${carpeta}/Estudio.pdf`, "viejo");
    await crear("_subidas/u1/1731600000001-Estudio.pdf", "nuevo");
    tablas.documentoContrato = [
      { id: "d0", storagePath: `${carpeta}/Estudio.pdf`, etapa: "PRECONTRACTUAL" },
      { id: "d1", storagePath: "_subidas/u1/1731600000001-Estudio.pdf", etapa: "PRECONTRACTUAL" },
    ];
    await organizarArchivos({ tipo: "contrato", id: "c1" });
    expect(tablas.documentoContrato[1]!.storagePath).toBe(`${carpeta}/Estudio_2.pdf`);
    expect(await fs.readFile(fisico(`${carpeta}/Estudio.pdf`), "utf8")).toBe("viejo");
    expect(await fs.readFile(fisico(`${carpeta}/Estudio_2.pdf`), "utf8")).toBe("nuevo");
  });

  it("al asignarse el número de contrato, la reorganización pasa los archivos a la carpeta nueva; la simulación no toca nada", async () => {
    contrato.numeroContrato = null;
    const viejo = "Gecon/2026/prestacion-de-servicios/expediente-CDMB-CTO-2026-000003/precontractual/Estudio.pdf";
    await crear(viejo);
    tablas.documentoContrato = [{ id: "d1", storagePath: viejo, etapa: "PRECONTRACTUAL" }];
    expect(await organizarArchivos({ tipo: "contrato", id: "c1" })).toEqual([]);

    contrato.numeroContrato = "1520-2026";
    const sim = await organizarArchivos({ tipo: "contrato", id: "c1" }, { simular: true });
    expect(sim[0]!.estado).toBe("simulado");
    expect(await existe(viejo)).toBe(true);

    await organizarArchivos({ tipo: "contrato", id: "c1" });
    expect(tablas.documentoContrato[0]!.storagePath).toBe("Gecon/2026/prestacion-de-servicios/contrato-1520-2026/precontractual/Estudio.pdf");
    expect(await existe("Gecon/2026/prestacion-de-servicios/expediente-CDMB-CTO-2026-000003")).toBe(false);
  });

  it("un archivo ausente se informa y su ruta no cambia", async () => {
    tablas.documentoContrato = [{ id: "d1", storagePath: "expedientes/u1/1-Falta.pdf", etapa: "CONTRACTUAL" }];
    const r = await organizarArchivos({ tipo: "contrato", id: "c1" });
    expect(r[0]!.estado).toBe("error");
    expect(tablas.documentoContrato[0]!.storagePath).toBe("expedientes/u1/1-Falta.pdf");
  });

  it("un adjunto compartido entre dos radicados se actualiza en ambos y, ya ordenado, no se vuelve a mover", async () => {
    comunicaciones.r1 = { anio: 2026, tipo: "RECIBIDA", radicado: "CDMB-R-2026-000010" };
    comunicaciones.e1 = { anio: 2026, tipo: "ENVIADA", radicado: "CDMB-E-2026-000004" };
    await crear("_subidas/u9/1731600000002-Respuesta.pdf");
    tablas.comunicacionDocumento = [
      { id: "a", comunicacionId: "r1", storagePath: "_subidas/u9/1731600000002-Respuesta.pdf", esRespuesta: true },
      { id: "b", comunicacionId: "e1", storagePath: "_subidas/u9/1731600000002-Respuesta.pdf" },
    ];
    await organizarArchivos({ tipo: "comunicacion", id: "r1" });
    const destino = "Correspondencia/2026/recibidas/CDMB-R-2026-000010/respuesta/Respuesta.pdf";
    expect(tablas.comunicacionDocumento.map((d) => d.storagePath)).toEqual([destino, destino]);

    const r = await organizarArchivos({ tipo: "comunicacion", id: "e1" });
    expect(r[0]!.estado).toBe("omitido");
    expect(await existe(destino)).toBe(true);
  });
});
