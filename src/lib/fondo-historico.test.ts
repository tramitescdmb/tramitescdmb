import { describe, it, expect } from "vitest";
import {
  parseFechaFondo,
  filaAModelo,
  esFondoValido,
  urlIntranetPsdocuments,
  parseDumpFondo,
} from "@/lib/fondo-historico";

describe("parseFechaFondo", () => {
  it("acepta ISO y YYYY-MM-DD", () => {
    expect(parseFechaFondo("2015-06-01")?.getFullYear()).toBe(2015);
    expect(parseFechaFondo("2015-06-01T00:00:00.000Z")?.getFullYear()).toBe(2015);
  });
  it("acepta DD/MM/YYYY (formato Oracle)", () => {
    const d = parseFechaFondo("03/12/2009");
    expect(d?.getFullYear()).toBe(2009);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(3);
  });
  it("descarta vacíos y años imposibles (typos de captura)", () => {
    expect(parseFechaFondo("")).toBeNull();
    expect(parseFechaFondo(null)).toBeNull();
    expect(parseFechaFondo("0201-05-04")).toBeNull();
    expect(parseFechaFondo("2502-05-04")).toBeNull();
  });
});

describe("filaAModelo", () => {
  it("arma el id compuesto y deriva el año", () => {
    const m = filaAModelo("psdocuments", {
      ref_id: "482913",
      serie_id: 101,
      serie_nombre: "CORRESPONDENCIA",
      fecha: "2011-03-15",
      asunto: "  Solicitud de copia  ",
      campos: { NUMENTRADA: "0012" },
    });
    expect(m.id).toBe("psdocuments:482913");
    expect(m.refId).toBe("482913");
    expect(m.anio).toBe(2011);
    expect(m.asunto).toBe("Solicitud de copia");
    expect(m.numeroEntrada).toBe("0012"); // NUMENTRADA se normaliza…
    expect(m.campos).toBeNull(); // …y no se repite en campos
    expect(m.tieneImagen).toBe(false);
  });
  it("guarda en campos solo las columnas que no quedaron normalizadas, recortadas", () => {
    const m = filaAModelo("psdocuments", {
      ref_id: "9",
      campos: { TIPO: "OFICIO", NUMENTRADA: "1", NOTAS: "x".repeat(300) },
    });
    expect(m.campos).not.toBeNull();
    expect(m.campos!.NUMENTRADA).toBeUndefined();
    expect(m.campos!.TIPO).toBe("OFICIO");
    expect((m.campos!.NOTAS as string).length).toBeLessThanOrEqual(121);
  });
  it("recorta el asunto largo", () => {
    const m = filaAModelo("psdocuments", { ref_id: "1", asunto: "a".repeat(500) });
    expect(m.asunto!.length).toBeLessThanOrEqual(301);
  });
  it("normaliza cadenas vacías a null", () => {
    const m = filaAModelo("psdocuments", { ref_id: "1", razon_social: "   ", numero: "" });
    expect(m.razonSocial).toBeNull();
    expect(m.numero).toBeNull();
  });
  it("deriva los campos normalizados desde las columnas crudas de la serie", () => {
    const m = filaAModelo("psdocuments", {
      ref_id: "7",
      serie_id: 101,
      campos: {
        NUMENTRADA: "0045",
        FECHAENTRADA: "2012-08-09",
        ASUNTO: "Traslado por competencia",
        RAZONSOCIAL: "ACUEDUCTO VEREDAL",
        DEPENDENCIA: "Subdirección Jurídica",
      },
    });
    expect(m.numero).toBe("0045");
    expect(m.numeroEntrada).toBe("0045");
    expect(m.anio).toBe(2012);
    expect(m.asunto).toBe("Traslado por competencia");
    expect(m.razonSocial).toBe("ACUEDUCTO VEREDAL");
    expect(m.oficina).toBe("Subdirección Jurídica");
  });
});

describe("esFondoValido", () => {
  it("solo reconoce fondos declarados", () => {
    expect(esFondoValido("psdocuments")).toBe(true);
    expect(esFondoValido("cualquier-cosa")).toBe(false);
  });
});

describe("parseDumpFondo", () => {
  const dump = [
    "#740654",
    "@NUMENTRADA",
    "=0045",
    "@ASUNTO",
    "=Solicitud con \"comillas\", coma y ",
    "=texto que sigue en otro trozo",
    "@OBSERVACIONES",
    "@__NARCH__",
    "=2",
    "@__RUTA__",
    "=z:/Documentos/00000101/OGALVIS/00694338.pdf",
    "#740655",
    "@NUMENTRADA",
    "=0046",
    "@__NARCH__",
    "=0",
  ].join("\n");

  it("reconstruye documentos, une trozos y separa columnas especiales", () => {
    const filas = parseDumpFondo(dump, 101, "CORRESPONDENCIA");
    expect(filas).toHaveLength(2);
    expect(filas[0]!.ref_id).toBe("740654");
    expect(filas[0]!.serie_id).toBe(101);
    expect(filas[0]!.campos!.NUMENTRADA).toBe("0045");
    expect(filas[0]!.campos!.ASUNTO).toBe('Solicitud con "comillas", coma y texto que sigue en otro trozo');
    expect(filas[0]!.campos!.OBSERVACIONES).toBeUndefined(); // campo sin valor
    expect(filas[0]!.num_archivos).toBe(2);
    expect(filas[0]!.tiene_imagen).toBe(true);
    expect(filas[0]!.ruta_original).toBe("z:/Documentos/00000101/OGALVIS/00694338.pdf");
    expect(filas[1]!.ref_id).toBe("740655");
    expect(filas[1]!.tiene_imagen).toBe(false);
  });

  it("filaAModelo deriva bien desde una fila del dump", () => {
    const filas = parseDumpFondo(dump, 101, "CORRESPONDENCIA");
    const m = filaAModelo("psdocuments", filas[0]!);
    expect(m.numeroEntrada).toBe("0045");
    expect(m.asunto?.startsWith('Solicitud con "comillas"')).toBe(true);
    expect(m.tieneImagen).toBe(true);
    expect(m.rutaOriginal).toContain("00694338.pdf");
  });
});

describe("urlIntranetPsdocuments", () => {
  it("mapea la unidad z: a la URL de intranet (barras \\ y /)", () => {
    expect(urlIntranetPsdocuments("z:\\Documentos\\00000262\\OGALVIS\\00694338.pdf")).toBe(
      "http://192.168.7.70/gestion/Documentos/00000262/OGALVIS/00694338.pdf",
    );
    expect(urlIntranetPsdocuments("z:/Documentos/00000101/BCHAPARRO/x.tif")).toBe(
      "http://192.168.7.70/gestion/Documentos/00000101/BCHAPARRO/x.tif",
    );
  });
  it("colapsa la barra doble de VER_CAMINO (que termina en \\)", () => {
    expect(urlIntranetPsdocuments("z:\\Documentos\\00000101\\ADMINISTRADOR\\\\00083608.001")).toBe(
      "http://192.168.7.70/gestion/Documentos/00000101/ADMINISTRADOR/00083608.001",
    );
  });
  it("devuelve null si no hay ruta o no tiene forma de unidad", () => {
    expect(urlIntranetPsdocuments(null)).toBeNull();
    expect(urlIntranetPsdocuments("")).toBeNull();
    expect(urlIntranetPsdocuments("/gestion/algo.pdf")).toBeNull();
  });
});
