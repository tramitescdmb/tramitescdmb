import { describe, it, expect } from "vitest";
import { normalizarDocumentosVital } from "@/lib/vital-documentos";

describe("normalizarDocumentosVital", () => {
  it("conserva los anexos sin dirección de descarga y acepta otros nombres de campo", () => {
    const docs = normalizarDocumentosVital({
      listaDocumentos: [
        { nombre_archivo: "476423093_136_Solicitud_rionegro_ctm12_20261117033842.zip", url_archivo: "http://vital/a.zip" },
        { nombre_archivo: "455236.rtf", url_archivo: null },
      ],
      acuse: [{ nombreArchivo: "AcuseRecibido_1210009153754726001.pdf", urlArchivo: "http://vital/acuse.pdf" }],
    });
    expect(docs.map((d) => d.nombre_archivo)).toEqual([
      "476423093_136_Solicitud_rionegro_ctm12_20261117033842.zip",
      "455236.rtf",
      "AcuseRecibido_1210009153754726001.pdf",
    ]);
    expect(docs[1].url_archivo).toBe("");
  });
  it("acepta un arreglo directo, deduce el nombre de la url y quita repetidos", () => {
    const docs = normalizarDocumentosVital([
      { url_archivo: "http://vital/carpeta/plano%201.pdf?x=1" },
      { url_archivo: "http://vital/carpeta/plano%201.pdf?x=1" },
      { otra: "cosa" },
    ]);
    expect(docs).toEqual([{ nombre_archivo: "plano 1.pdf", url_archivo: "http://vital/carpeta/plano%201.pdf?x=1" }]);
  });
  it("devuelve vacío si no hay lista", () => {
    expect(normalizarDocumentosVital(null)).toEqual([]);
    expect(normalizarDocumentosVital({ mensaje: "ok" })).toEqual([]);
  });
});
